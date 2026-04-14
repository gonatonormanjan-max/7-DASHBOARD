import type { Role } from "@prisma/client";

export type PermissionResource =
  | "dashboard"
  | "products"
  | "categories"
  | "locations"
  | "inventory"
  | "suppliers"
  | "purchase_orders"
  | "sales_orders"
  | "reports"
  | "users"
  | "audit_logs"
  | "settings";

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
  | "settings";

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
    suppliers: ALL_ACTIONS,
    purchase_orders: ALL_ACTIONS,
    sales_orders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ALL_ACTIONS,
    audit_logs: ALL_ACTIONS,
    settings: ALL_ACTIONS,
  },
  SYSTEM_MANAGER: {
    dashboard: ALL_ACTIONS,
    products: ALL_ACTIONS,
    categories: ALL_ACTIONS,
    locations: ALL_ACTIONS,
    inventory: ALL_ACTIONS,
    suppliers: ALL_ACTIONS,
    purchase_orders: ALL_ACTIONS,
    sales_orders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ["create", "read", "update"],
    audit_logs: ["read"],
    settings: ["read", "create", "update"],
  },
  SALES_STAFF: {
    dashboard: ["read"],
    products: ["read"],
    categories: ["read"],
    locations: ["read"],
    inventory: ["read"],
    sales_orders: ["create", "read", "update"],
    reports: ["read"],
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

export function getNavItems(role: Role) {
  return NAV_ITEMS.filter((item) => hasPermission(role, item.resource, item.action));
}

export function getRoleLabel(role: Role) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "SYSTEM_MANAGER":
      return "System Manager";
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
    case "SALES_STAFF":
      return "Sales execution access with controlled stock effects through approved workflows.";
  }
}
