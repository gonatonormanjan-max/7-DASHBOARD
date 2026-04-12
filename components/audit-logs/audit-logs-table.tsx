import type { AuditLogRow } from "@/lib/dal/audit-logs";
import { getRoleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Action label map — every logAudit() call in the system
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  // Users
  "user.create": "Account Created",
  "user.update": "Account Updated",
  // Products
  "product.create": "Product Created",
  "product.update": "Product Updated",
  "product.archive": "Product Archived",
  "product.deactivate": "Product Deactivated",
  "product.restore": "Product Restored",
  "product.bulk_import": "Bulk Import",
  // Categories
  "category.create": "Category Created",
  "category.update": "Category Updated",
  "category.delete": "Category Deleted",
  // Brands
  "brand.create": "Brand Created",
  "brand.update": "Brand Updated",
  "brand.delete": "Brand Deleted",
  // Suppliers
  "supplier.create": "Supplier Created",
  "supplier.update": "Supplier Updated",
  // Inventory
  "inventory.adjust": "Stock Adjusted",
  "inventory.supplier_receipt": "Supplier Receipt",
  "inventory.transfer": "Stock Transferred",
  "inventory.initial_stock": "Initial Stock",
  "inventory.bulk_stock_setup": "Bulk Stock Setup",
  // Purchase Orders
  "purchase_order.create": "PO Created",
  "purchase_order.approve": "PO Approved",
  "purchase_order.cancel": "PO Cancelled",
  "purchase_order.receive": "PO Received",
  // Sales Orders
  "sales_order.create": "Order Created",
  "sales_order.confirm": "Order Confirmed",
  "sales_order.deliver": "Order Delivered",
  "sales_order.complete": "Order Completed",
  "sales_order.cancel": "Order Cancelled",
  "sales_order.void": "Order Voided",
  "sales_order.archive": "Order Archived",
  "sales_order.unarchive": "Order Unarchived",
  "sales_order.bulk_archive": "Orders Bulk Archived",
  // Locations
  "location.create": "Location Created",
  "location.update": "Location Updated",
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// ---------------------------------------------------------------------------
// Action badge colour — grouped by module prefix
// ---------------------------------------------------------------------------

function getActionBadgeClass(action: string): string {
  if (action.startsWith("inventory."))
    return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
  if (action.startsWith("sales_order."))
    return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
  if (action.startsWith("purchase_order."))
    return "border-amber-200 bg-amber-50 text-[#8a5610]";
  if (action.startsWith("product."))
    return "border-blue-200 bg-blue-50 text-blue-800";
  if (action.startsWith("supplier."))
    return "border-orange-200 bg-orange-50 text-orange-800";
  if (action.startsWith("user."))
    return "border-[#dcccf8] bg-[#f5efff] text-[#5f3ca2]";
  if (action.startsWith("location."))
    return "border-slate-200 bg-slate-100 text-slate-600";
  // category / brand / fallback
  return "border-slate-200 bg-slate-50 text-slate-700";
}

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

function getRoleBadgeClass(role: AuditLogRow["user"]["role"]): string {
  switch (role) {
    case "ADMIN":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
    case "SYSTEM_MANAGER":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "SALES_STAFF":
      return "border-amber-200 bg-amber-50 text-[#8a5610]";
  }
}

// ---------------------------------------------------------------------------
// Details summary — parse the JSON and surface 2–3 key facts as plain text
// so the row is self-explanatory without exposing raw JSON
// ---------------------------------------------------------------------------

type DetailsFact = { label: string; value: string };

function parseDetailsFacts(
  action: string,
  details: AuditLogRow["details"]
): DetailsFact[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }

  const d = details as Record<string, unknown>;

  const str = (v: unknown) => (v != null ? String(v) : "");
  const num = (v: unknown) => (v != null ? String(v) : "");

  // Inventory actions
  if (action === "inventory.adjust") {
    return [
      { label: "Product", value: str(d.productName) },
      { label: "Location", value: str(d.locationName) },
      {
        label: "Change",
        value: `${d.direction === "increase" ? "+" : "-"}${num(d.quantity)} units`,
      },
      { label: "Reason", value: str(d.reason).replace(/_/g, " ") },
    ].filter((f) => f.value);
  }

  if (action === "inventory.transfer") {
    return [
      { label: "Product", value: str(d.productName) },
      { label: "From", value: str(d.fromLocationName) },
      { label: "To", value: str(d.toLocationName) },
      { label: "Qty", value: `${num(d.quantity)} units` },
    ].filter((f) => f.value);
  }

  if (action === "inventory.supplier_receipt") {
    return [
      { label: "Supplier", value: str(d.supplierName) },
      { label: "Location", value: str(d.locationName) },
      { label: "Items", value: `${num(d.itemCount)} line(s)` },
      ...(d.referenceNumber
        ? [{ label: "Ref", value: str(d.referenceNumber) }]
        : []),
    ].filter((f) => f.value);
  }

  if (
    action === "inventory.initial_stock" ||
    action === "inventory.bulk_stock_setup"
  ) {
    return [
      { label: "Location", value: str(d.locationName) },
      ...(d.productName
        ? [{ label: "Product", value: str(d.productName) }]
        : []),
      ...(d.itemCount
        ? [{ label: "Items", value: `${num(d.itemCount)} line(s)` }]
        : []),
    ].filter((f) => f.value);
  }

  // Sales order actions
  if (
    action === "sales_order.confirm" ||
    action === "sales_order.deliver" ||
    action === "sales_order.complete" ||
    action === "sales_order.cancel" ||
    action === "sales_order.archive" ||
    action === "sales_order.unarchive"
  ) {
    return [
      { label: "Order", value: str(d.orderNumber) },
      ...(d.customerName
        ? [{ label: "Customer", value: str(d.customerName) }]
        : []),
    ].filter((f) => f.value);
  }

  if (action === "sales_order.void") {
    return [
      { label: "Order", value: str(d.orderNumber) },
      { label: "Reason", value: str(d.voidReason).replace(/_/g, " ") },
    ].filter((f) => f.value);
  }

  if (action === "sales_order.bulk_archive") {
    return [
      { label: "Orders", value: `${num(d.count)} archived` },
    ].filter((f) => f.value);
  }

  // Purchase order actions
  if (
    action === "purchase_order.create" ||
    action === "purchase_order.approve" ||
    action === "purchase_order.cancel"
  ) {
    return [
      { label: "PO", value: str(d.orderNumber) },
      { label: "Supplier", value: str(d.supplierName) },
    ].filter((f) => f.value);
  }

  if (action === "purchase_order.receive") {
    return [
      { label: "PO", value: str(d.orderNumber) },
      { label: "Location", value: str(d.locationName) },
      ...(d.itemCount
        ? [{ label: "Items", value: `${num(d.itemCount)} line(s)` }]
        : []),
    ].filter((f) => f.value);
  }

  // Product actions
  if (action === "product.create" || action === "product.update") {
    return [
      { label: "Product", value: str(d.name) },
      { label: "SKU", value: str(d.sku) },
    ].filter((f) => f.value);
  }

  if (
    action === "product.archive" ||
    action === "product.deactivate" ||
    action === "product.restore"
  ) {
    return [
      { label: "Product", value: str(d.name) },
      { label: "SKU", value: str(d.sku) },
    ].filter((f) => f.value);
  }

  if (action === "product.bulk_import") {
    return [
      { label: "Created", value: `${num(d.created)} products` },
      ...(d.updated ? [{ label: "Updated", value: `${num(d.updated)} products` }] : []),
    ].filter((f) => f.value);
  }

  // Supplier actions
  if (action === "supplier.create" || action === "supplier.update") {
    return [
      { label: "Supplier", value: str(d.name) },
    ].filter((f) => f.value);
  }

  // User actions
  if (action === "user.create" || action === "user.update") {
    return [
      {
        label: "Account",
        value: d.firstName && d.lastName
          ? `${d.firstName} ${d.lastName}`
          : str(d.email),
      },
      { label: "Role", value: str(d.role).replace(/_/g, " ") },
    ].filter((f) => f.value);
  }

  // Category / Brand actions
  if (
    action === "category.create" ||
    action === "category.update" ||
    action === "brand.create" ||
    action === "brand.update"
  ) {
    return [{ label: "Name", value: str(d.name) }].filter((f) => f.value);
  }

  // Location actions
  if (action === "location.create" || action === "location.update") {
    return [
      { label: "Location", value: str(d.name) },
      { label: "Code", value: str(d.code) },
    ].filter((f) => f.value);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes <= 0) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteTime(date: Date): string {
  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}

// ---------------------------------------------------------------------------
// Entity label — human-readable name for the entity field
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  location_stock: "Stock",
  inventory_transfer: "Transfer",
  supplier_receipt: "Supplier Receipt",
  bulk_stock_setup: "Bulk Stock Setup",
  user: "User",
  product: "Product",
  category: "Category",
  brand: "Brand",
  supplier: "Supplier",
  purchase_order: "Purchase Order",
  sales_order: "Sales Order",
  location: "Location",
};

function getEntityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type AuditLogsTableProps = {
  logs: AuditLogRow[];
};

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No activity found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          No audit log entries match the current filters. Try adjusting the date range or module selection.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4 whitespace-nowrap">When</th>
              <th className="px-5 py-4 whitespace-nowrap">Performed by</th>
              <th className="px-5 py-4 whitespace-nowrap">Action</th>
              <th className="px-5 py-4 whitespace-nowrap">Subject</th>
              <th className="px-5 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {logs.map((log) => {
              const facts = parseDetailsFacts(log.action, log.details);

              return (
                <tr key={log.id} className="align-top">
                  {/* Timestamp */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-slate-900">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatAbsoluteTime(log.createdAt)}
                    </p>
                  </td>

                  {/* Performed by */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {log.user.firstName} {log.user.lastName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 truncate max-w-[180px]">
                      {log.user.email}
                    </p>
                    <span
                      className={cn(
                        "mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        getRoleBadgeClass(log.user.role)
                      )}
                    >
                      {getRoleLabel(log.user.role)}
                    </span>
                  </td>

                  {/* Action badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                        getActionBadgeClass(log.action)
                      )}
                    >
                      {getActionLabel(log.action)}
                    </span>
                  </td>

                  {/* Subject / entity */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {getEntityLabel(log.entity)}
                    </p>
                    <p
                      className="mt-1 font-mono text-[10px] text-slate-400 truncate max-w-[140px]"
                      title={log.entityId}
                    >
                      {log.entityId}
                    </p>
                  </td>

                  {/* Parsed details */}
                  <td className="px-5 py-4">
                    {facts.length > 0 ? (
                      <dl className="space-y-1">
                        {facts.map((fact) => (
                          <div key={fact.label} className="flex items-baseline gap-1.5 text-sm">
                            <dt className="shrink-0 text-xs font-medium text-slate-400 uppercase tracking-[0.12em]">
                              {fact.label}
                            </dt>
                            <dd className="text-slate-700 truncate max-w-[220px]" title={fact.value}>
                              {fact.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No details</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
