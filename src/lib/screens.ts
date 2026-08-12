export type SystemRole = "initiator" | "approver" | "admin" | "viewer";
/** Roles are dynamic: the four built-ins plus any custom role created by an admin. */
export type Role = string;

export const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
  { value: "initiator", label: "Initiator" },
  { value: "approver", label: "Approver" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

/** Legacy alias. */
export const ROLES = SYSTEM_ROLES;

export type ScreenKey =
  | "dashboard"
  | "nfa_new"
  | "nfa_my"
  | "approvals"
  | "report"
  | "sap_api"
  | "user_management";

export const SCREENS: { key: ScreenKey; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "nfa_new", label: "Create NFA", path: "/nfa/new" },
  { key: "nfa_my", label: "My NFAs", path: "/nfa/my" },
  { key: "approvals", label: "Approvals", path: "/approvals" },
  { key: "report", label: "E-NFA Report", path: "/report" },
  { key: "sap_api", label: "SAP API Settings", path: "/admin/sap-api" },
  { key: "user_management", label: "User Management", path: "/admin/users" },
];
