import type { Role } from "@prisma/client";

export type PermissionResource =
  | "dashboard"
  | "products"
  | "categories"
  | "locations"
  | "inventory"
  | "daily_ops"
  | "issue_reports"
  | "suppliers"
  | "purchase_orders"
  | "sales_orders"
  | "reports"
  | "users"
  | "audit_logs"
  | "settings"
  | "adjustment_requests"
  | "branch_pricing"
  | "vault";

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "receive"
  | "export";

export type NavIcon =
  | "dashboard"
  | "boxes"
  | "layers"
  | "truck"
  | "warehouse"
  | "move"
  | "clipboard"
  | "shopping-cart"
  | "chart"
  | "users"
  | "shield"
  | "settings"
  | "wallet";

export type NavItem = {
  title: string;
  href: string;
  icon: NavIcon;
  section: "Overview" | "Operations" | "Management" | "System";
  resource: PermissionResource;
  action: PermissionAction;
};

const ALL_ACTIONS: PermissionAction[] = [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "receive",
  "export",
];

export const permissionMatrix: Record<
  Role,
  Partial<Record<PermissionResource, PermissionAction[]>>
> = {
  ADMIN: {
    dashboard: ALL_ACTIONS,
    products: ALL_ACTIONS,
    categories: ALL_ACTIONS,
    locations: ALL_ACTIONS,
    inventory: ALL_ACTIONS,
    daily_ops: ALL_ACTIONS,
    issue_reports: ALL_ACTIONS,
    suppliers: ALL_ACTIONS,
    purchase_orders: ALL_ACTIONS,
    sales_orders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ALL_ACTIONS,
    audit_logs: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    adjustment_requests: ALL_ACTIONS,
    branch_pricing: ALL_ACTIONS,
    vault: ALL_ACTIONS,
  },
  SYSTEM_MANAGER: {
    dashboard: ALL_ACTIONS,
    products: ALL_ACTIONS,
    categories: ALL_ACTIONS,
    locations: ALL_ACTIONS,
    inventory: ALL_ACTIONS,
    daily_ops: ["read", "export"],
    issue_reports: ["read", "update"],
    suppliers: ALL_ACTIONS,
    purchase_orders: ALL_ACTIONS,
    sales_orders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ["create", "read", "update"],
    audit_logs: ["read"],
    settings: ["read", "create", "update"],
    adjustment_requests: ["read"],
    branch_pricing: ["read"],
    vault: ["read"],
  },
  // Branch-level operational role. All data access is scoped to the manager's
  // assigned branch. Cannot manage users, settings, or execute direct stock
  // mutations — manual adjustments require admin approval.
  MANAGER: {
    dashboard: ALL_ACTIONS,
    products: ["read"],
    categories: ["read"],
    locations: ["read"],
    inventory: ["read", "export"],
    daily_ops: ["create", "read"],
    issue_reports: ["create", "read"],
    suppliers: ["read"],
    purchase_orders: ["create", "read", "update"],
    sales_orders: ["create", "read", "update"],
    reports: ["read", "export"],
    audit_logs: ["read"],
    adjustment_requests: ["create", "read"],
    // MANAGER can set prices for their own branch only.
    // The server action enforces the branch-scope constraint.
    branch_pricing: ["create", "read", "update", "delete"],
    // MANAGER can record cash drops (vault.create) from their assigned branch.
    vault: ["read", "create"],
  },
  SALES_STAFF: {
    dashboard: ["read"],
    products: ["read"],
    categories: ["read"],
    locations: ["read"],
    inventory: ["read"],
    daily_ops: ["create", "read"],
    sales_orders: ["create", "read", "update"],
  },
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    section: "Overview",
    resource: "dashboard",
    action: "read",
  },
  {
    title: "Products",
    href: "/dashboard/products",
    icon: "boxes",
    section: "Operations",
    resource: "products",
    action: "read",
  },
  {
    title: "Categories",
    href: "/dashboard/categories",
    icon: "layers",
    section: "Operations",
    resource: "categories",
    action: "read",
  },
  {
    title: "Locations",
    href: "/dashboard/locations",
    icon: "warehouse",
    section: "Operations",
    resource: "locations",
    action: "read",
  },
  {
    title: "Inventory",
    href: "/dashboard/inventory",
    icon: "move",
    section: "Operations",
    resource: "inventory",
    action: "read",
  },
  {
    title: "Daily Operations",
    href: "/dashboard/daily-ops",
    icon: "clipboard",
    section: "Operations",
    resource: "daily_ops",
    action: "read",
  },
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: "truck",
    section: "Operations",
    resource: "suppliers",
    action: "read",
  },
  {
    title: "Purchase Orders",
    href: "/dashboard/purchase-orders",
    icon: "clipboard",
    section: "Management",
    resource: "purchase_orders",
    action: "read",
  },
  {
    title: "Sales Orders",
    href: "/dashboard/sales-orders",
    icon: "shopping-cart",
    section: "Management",
    resource: "sales_orders",
    action: "read",
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: "chart",
    section: "Management",
    resource: "reports",
    action: "read",
  },
  {
    title: "Branch Vault",
    href: "/dashboard/vault",
    icon: "wallet",
    section: "Management",
    resource: "vault",
    action: "read",
  },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: "users",
    section: "System",
    resource: "users",
    action: "read",
  },
  {
    title: "Audit Logs",
    href: "/dashboard/audit-logs",
    icon: "shield",
    section: "System",
    resource: "audit_logs",
    action: "read",
  },
  // Settings nav item intentionally hidden — section not yet built
  // {
  //   title: "Settings",
  //   href: "/dashboard/settings",
  //   icon: "settings",
  //   section: "System",
  //   resource: "settings",
  //   action: "read",
  // },
];

export function hasPermission(
  role: Role,
  resource: PermissionResource,
  action: PermissionAction
) {
  return permissionMatrix[role]?.[resource]?.includes(action) ?? false;
}

export function canAccessAllBranchActivityReport(role: Role) {
  return role === "ADMIN" || role === "SYSTEM_MANAGER";
}

export function canAccessBranchSalesOrdersReport(role: Role) {
  return canAccessAllBranchActivityReport(role);
}

export function canFilterReportsAnalyticsByBranch(role: Role) {
  return canAccessAllBranchActivityReport(role);
}

export function getNavItems(role: Role) {
  return NAV_ITEMS.filter((item) => hasPermission(role, item.resource, item.action));
}

export function getRoleLabel(role: Role) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "SYSTEM_MANAGER":
      return "System Manager";
    case "MANAGER":
      return "Manager";
    case "SALES_STAFF":
      return "Sales Staff";
  }
}

export function getRoleDescription(role: Role) {
  switch (role) {
    case "ADMIN":
      return "";
    case "SYSTEM_MANAGER":
      return "Operational control with strong oversight and limited ownership settings.";
    case "MANAGER":
      return "Branch-level operational access. Data is scoped to the assigned branch. Stock adjustments require admin approval.";
    case "SALES_STAFF":
      return "Sales execution access with controlled stock effects through approved workflows.";
  }
}
