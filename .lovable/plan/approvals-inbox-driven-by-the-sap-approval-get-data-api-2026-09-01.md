# Approvals Inbox driven by the SAP "Approval Get Data" API

Drive the Approvals worklist with SAP's `get_data` call using the logged-in user's User ID, fully dynamic and visible in Inspect → Network.

## API Settings

The existing row stays the single source of truth (no hardcoding anywhere):

- Name: `Approval Get Data`
- Method: `PUT`
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Auth `Basic`, SAP system "Use active system", active.

Host, credentials, headers and query resolve from the saved SAP system. Editing this row in Settings changes exactly what the Approvals screen calls.

## Request / response contract

```text
PUT http://10.200.1.2:8000/e-nfa/enfa_approval/APPROVAL?sap-client=300
{ "get_data": { "user_name": "<LOGGED-IN USER ID>" } }

Response (success): [ { "REFFLD": "100080", "PSPNR": "9000", "NAME1": "...", "FUNCT": "...", "BEGDA": "...", "SUBJECT": "..." } ]
Response (no records / wrong user): "No data is available for the current user"  (plain text)
```

The browser posts the exact payload SAP receives — `{ "get_data": { "user_name": ... } }` — so Request Payload in Network matches verbatim. The proxy response headers (`x-sap-url`, `x-sap-method`, `x-sap-request`, `x-sap-status`, `x-sap-latency-ms`) already expose the real SAP call details; they stay.

## Changes

1. **`src/routes/_authed.approvals.tsx`**
   - Resolve the logged-in user's User ID from `profiles.username` (same ID typed on the login screen), cached per session and keyed per user id so switching accounts refetches.
   - Send `body: { "get_data": { "user_name": "<USERNAME>.toUpperCase()" } }` to `/api/public/enfa-approval` instead of the current `{ "get_data": "" }`.
   - If the profile has no username, fall back to an empty `user_name` — the server then fills it from the endpoint's stored SAP credential (no errors, no hardcoded IDs).
   - Handle SAP's plain-text "No data is available for the current user" reply: the proxy wraps it as `{ "message": "..." }`, and the screen shows it as an inline notice with zero rows (loading/empty/error/Retry behavior unchanged).

2. **`src/lib/sap-report.server.ts` — `callEnfaApproval(overrides?)`**
   - Accept an optional caller-supplied `get_data` object and merge it over the endpoint's saved body template; default template becomes `{ "get_data": { "user_name": "" } }` when the saved row has no template.
   - When `user_name` is absent/empty, inject the resolved SAP credential username (uppercased) — same pattern as the Edit flow.

3. **`src/routes/api/public/enfa-approval.ts`**
   - Parse the incoming body and forward `get_data.user_name` to `callEnfaApproval`.
   - Non-JSON SAP replies are wrapped as `{ "message": "<SAP text>" }` so the UI never hits a JSON parse error; JSON arrays pass through unchanged. Bearer verification and the `x-sap-*` headers stay as they are.

## Not touched

- Approve / Reject / Back To Initiator / Clarification flows, Preview, Attached Docs, search, selection, and all other screens — no schema changes, no new endpoints, no visual changes.

## Technical notes

- `profiles.username` is the User ID used by `resolve_login_email` at login; RLS lets a user read their own profile row.
- Verify with the build, then open Approvals and confirm Network shows the `get_data.user_name` payload and the `x-sap-*` headers on the response.
