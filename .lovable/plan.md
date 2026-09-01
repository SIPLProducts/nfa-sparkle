# E-NFA Report: send the exact SAP payload and show SAP's real reply

## What happens today (verified in the code)

- The Report screen posts `{ report: { plant_from, ... , r_init, r_clar } }` to the app's proxy **without** `user_name`; the server adds `user_name` from the endpoint's stored SAP credential. So the payload in Inspect → Network is one key short of what SAP actually receives.
- When SAP answers with the plain sentence `Data is not availble` (wrong user), the screen cannot parse it as JSON and shows the generic error "Could not read the SAP response (it was not valid JSON)" instead of SAP's own message.
- URL (`/e-nfa/enfa_report//create?sap-client=300`), method (PUT), auth and system already come from Admin → SAP API Settings — nothing hardcoded there — and the proxy already returns `x-sap-url`, `x-sap-method`, `x-sap-request`, `x-sap-status`, `x-sap-latency-ms`.

## Changes

1. **`user_name` is sent by the browser, dynamically.** Before running the report, the screen resolves the logged-in user's User ID (`profiles.username`, uppercased) — the same lookup the Edit dialog already uses, with the same per-session cache — and includes it as the first key of the `report` object. Request Payload in Network then matches SAP byte-for-byte:

```text
{ "report": { "user_name": "<logged-in user id>", "plant_from": "9000", "plant_to": "", ... , "r_init": "X", "r_clar": "" } }
```

2. **The server honours the payload it receives.** `buildReportPayload` keeps `user_name` when the caller supplies it and only falls back to the endpoint/system credential when it is absent — no dummy or hardcoded user.

3. **Plain-text SAP replies are surfaced as-is.** The proxy route wraps a non-JSON SAP body as `{ "message": "Data is not availble" }` (same treatment the Edit/detail route already applies), and the Report screen shows that message in the results area and as a toast, with zero rows — instead of the generic parse error. Genuine JSON arrays keep flowing to the table and CSV export unchanged.

4. **Response stays verbatim** in the Response tab: SAP's array of `REFFLD / PSPNR / NAME1 / FUNCT_TXT / EXTR_TXT / SUBJECT / INIT_NAME / BEGDA / ROLE1..6 / APPR1..6 / STAT1..6 / STATUS_TXT`, all of which the results table already maps, including the "With initiator" status badge.

## Technical notes

- `src/lib/sap-api-constants.ts` — `wrapReportPayload` already emits `user_name` first when given; the Report screen starts passing it.
- `src/routes/_authed.report.tsx` — resolve the User ID once per session, add it to the payload, and render a SAP `message` reply as an empty-result notice.
- `src/lib/sap-report.server.ts` — `buildReportPayload` preserves an incoming `user_name`; `callEnfaReport` uses it when present, else the resolved endpoint credential (uppercased).
- `src/routes/api/public/enfa-report.ts` — wrap non-JSON SAP bodies as `{ message }`; headers unchanged.
- No schema changes, no changes to Upload / Attached Docs / Preview / Edit, filters, caching or refresh behaviour.
