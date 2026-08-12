export type Role = "initiator" | "approver" | "admin" | "viewer";

export const ROLES: { value: Role; label: string }[] = [
  { value: "initiator", label: "Initiator" },
  { value: "approver", label: "Approver" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

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