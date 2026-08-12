export const SAP_MODULES = ["Common", "MM", "SD", "FI", "PP", "QM", "PM", "HR"] as const;
export const SAP_AUTH_TYPES = [
  { value: "basic", label: "Basic" },
  { value: "bearer", label: "Bearer token" },
  { value: "proxy", label: "Proxy / Middleware" },
  { value: "none", label: "None" },
];
export const SAP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const SAP_API_TYPES = [
  { value: "fetch", label: "fetch (live pass-through)" },
  { value: "sync", label: "sync (scheduled cache)" },
  { value: "push", label: "push (outbound to SAP)" },
];
export const SAP_ENVIRONMENTS = ["DEV", "QUALITY", "PROD"] as const;
export const CONNECTION_MODES = [
  { value: "direct", label: "Direct to SAP" },
  { value: "proxy", label: "Via Proxy Server" },
];
export const DEPLOYMENT_MODES = [
  { value: "lovable_cloud", label: "Lovable Cloud" },
  { value: "on_premise", label: "On-premise" },
  { value: "hybrid", label: "Hybrid" },
];
