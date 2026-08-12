# SAP API Settings (Admin)

Add an admin-only "SAP API Settings" area for registering SAP/REST endpoints, storing the shared SAP connection, and configuring the Node.js middleware — matching the reference screens.

## Screens

1. **SAP API Settings** (`/admin/sap-api`) — page header with subtitle, three tabs:
   - **APIs** — "New endpoint" button + responsive card grid. Each card: name, description, module chip, auth-type chip, Active/Inactive pill, last-synced text, and Edit / Test / Delete actions. "Register a new SAP endpoint" dialog with Name, Description, Module, Auth type, Endpoint Path or URL (relative paths inherit the Base URL).
   - **SAP Connection** — Environment, SAP Base URL, Username, Password (write-only, shows a "set" badge, blank = keep existing), Save + Test connection.
   - **Middleware Configuration** — Connection Mode, Deployment Mode, Middleware Port, Node.js Middleware URL, Proxy Secret (write-only), Save + Test middleware.

2. **Endpoint detail** (`/admin/sap-api/$id`) — Back link, endpoint name, module chip, Test connection button, and tabs:
   - **Details** — Name, Module, Description, Endpoint Path/URL, HTTP method, Auth type, API type, Active toggle, Save.
   - **Request** — headers, query params, JSON body template.
   - **Response** — sample/last response viewer with status, latency, pretty-printed body.
   - **Credentials** — per-endpoint override of username/password/token (blank = inherit SAP Connection).
   - **Scheduler** — enable toggle, cron/interval, next-run note.
   - **Connectivity** — last test result, status, latency, error text, history of recent tests.

## Access

Admin-only. Routes live under the existing signed-in layout and redirect non-admins back to the dashboard; a "SAP API Settings" item appears in the sidebar Admin section only for admins.

## Testing endpoints

"Test connection", "Test endpoint" and "Test middleware" run server-side, call the configured URL with the stored credentials, and return status code, latency and a truncated response body. Secrets never leave the server.

## Technical notes

- New tables: `sap_connection` (single row: environment, base_url, username, password), `sap_middleware_config` (connection_mode, deployment_mode, port, url, proxy_secret), `sap_endpoint` (name, description, module, path_or_url, http_method, auth_type, api_type, active, credentials, request config, scheduler config, last_test_* fields, last_synced_at).
- RLS: admins can read/write everything **except** secret columns. Secret columns (`password`, `proxy_secret`, endpoint credential values) are kept in a separate `private` schema table reachable only by `service_role`, so the browser can never read them; the UI shows a "set" badge instead.
- Server functions in `src/lib/sap-api.functions.ts` with `requireSupabaseAuth` + admin role check for reads/writes and for the test calls (fetch with timeout, no redirects followed, body truncated to ~4 KB).
- UI built from existing shadcn primitives (Tabs, Card, Dialog, Input, Select, Switch, Button) and existing design tokens; fully responsive with the same look and feel as the rest of the portal.
