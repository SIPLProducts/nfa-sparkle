# eNFA Report payload: wrap in a `report` object

SAP now expects the 15 filter fields nested under a top-level `report` key, with three keys carrying a trailing space exactly as in your sample.

## New payload shape

```text
{
  "report": {
    "plant_from": "9000",
    "plant_to": "9010",
    "funct_from": "", "funct_to": "",
    "nfano_from": "", "nfano_to ": "",
    "extra_from": "", "extra_to ": "",
    "dat_from": "", "dat_to": "",
    "usrid_from": "", "usrid_to": "",
    "r_proc": "", "r_comp ": "", "r_reje": ""
  }
}
```

Keys `nfano_to `, `extra_to ` and `r_comp ` keep their trailing space byte-for-byte. Values stay fully dynamic from the filters.

## Changes

1. **Report screen** (`src/routes/_authed.report.tsx`) — the POST body sent to `/api/enfa-report` becomes the wrapped object, so DevTools → Network shows exactly the structure above. Internal filter state keeps clean key names; the wire keys are produced at send time.
2. **API endpoint builder** (`src/lib/sap-report.server.ts`) — `buildReportPayload` accepts both a flat object and a `{ report: {...} }` body (and tolerates the spaced key variants on input), then emits the wrapped, space-exact payload that is forwarded to SAP.
3. **Server function** (`src/lib/sap-api.functions.ts`) — `runSapEnfaReport` builds and sends the same wrapped payload so both callers stay identical.
4. **API Integration screen** — the registered `eNFA Report` endpoint's stored request body template is updated (via migration) to the new wrapped JSON, so "Test connection" on the endpoint detail page sends the same structure.

Response handling is unchanged: SAP's array (bare or wrapped) still feeds the results table and CSV export.

## Technical notes

- A `WIRE_KEYS` map (internal key -> exact SAP key, including trailing spaces) lives in `src/lib/sap-report.server.ts` and is reused by the route, the server function and the screen via a shared client-safe constant.
- The migration updates `public.sap_endpoint.request_body` for the row matched by `name = 'eNFA Report'` / `path_or_url LIKE '%enfa_report%'`.
