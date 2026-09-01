# My NFAs: send the exact SAP payload for "Display Edit Data" and show SAP's real reply

## Current behavior (verified in code)

- The My NFAs screen posts `{ "report": "" }` to `/api/public/enfa-display-edit`; the server (`callEnfaDisplayEditData`) sends the endpoint's stored body template as-is (default `{ "report": "" }`) — no `user_name` is ever sent, so SAP's expected payload `{ "report": { "user_name": "<user id>" } }` is never formed.
- When SAP answers with the plain sentence `Data is not availble` (wrong user), the proxy returns the raw text; the screen fails to parse it and shows a generic notice instead of SAP's own message.
- URL, PUT method, auth and SAP system already come from Admin → SAP API Settings (the "Display Edit Data" row) — nothing hardcoded — and the proxy already returns `x-sap-url` / `x-sap-method` / `x-sap-request` / `x-sap-status` / `x-sap-latency-ms` headers.

## Changes

1. **`user_name` is sent by the browser, dynamically.** Before loading the list, the My NFAs screen resolves the logged-in user's User ID (`profiles.username`, uppercased — the same lookup the Edit dialog already uses, with the same per-session cache) and posts:

```text
POST /api/public/enfa-display-edit
{ "report": { "user_name": "<LOGGED-IN USER ID>" } }
```

so the Request Payload in Inspect → Network matches SAP byte-for-byte.

2. **The server honours the payload it receives.** `callEnfaDisplayEditData` accepts an optional caller-supplied `report` object: when `user_name` is present it is sent unchanged; when absent it falls back to the endpoint/system credential (uppercased). The saved body template's wrapper key (`report`) is respected — no dummy or hardcoded users.

3. **Plain-text SAP replies are surfaced as-is.** The proxy wraps a non-JSON SAP body as `{ "message": "Data is not availble" }` (same treatment already used by the Report route), and the My NFAs screen shows that message inline with zero rows plus a toast — instead of a generic parse error. Genuine JSON arrays keep flowing to the table unchanged.

4. **Response stays verbatim** in the Network Response tab: SAP's array of `REFFLD / PSPNR / NAME1 / FUNCT_TXT / BEGDA / APPR1..6 / STAT1..6 / STATUS_TXT`, which the My NFAs table already maps (status badges, L1–L6 columns).

## Technical notes

- `src/lib/sap-report.server.ts` — extend `callEnfaDisplayEditData(overrides?)` to merge a caller-supplied `user_name` into the saved body template; fallback to the resolved credential only when absent.
- `src/routes/api/public/enfa-display-edit.ts` — read the request body, pass it through, wrap non-JSON SAP bodies as `{ message }`; auth and `x-sap-*` headers unchanged.
- `src/routes/_authed.nfa.my.tsx` — resolve the User ID once per session (cache keyed by auth user id), include it in the payload, render a SAP `message` reply as an empty-list notice. Refresh-on-entry behavior, Upload/Attached Docs/Preview/Edit toolbar, and Edit dialog flow are untouched.
- No schema changes, no new endpoints, no changes to any other screen.
