# Show the real SAP request/response in Inspect → Network

## What you see today

Opening **Edit** on a record shows this in Network:

```text
POST /api/public/enfa-detail
{ "edit": { "reffld": "100069" } }
```

The call that actually reaches SAP is different: the server adds the SAP user and
sends it to the SAP URL from Admin → SAP API Settings:

```text
PUT http://<sap-host>/e-nfa/enfa_approval/APPROVAL?sap-client=300
{ "edit": { "user_name": "SIPL_QM", "reffld": "100069" } }
```

Because the browser only talks to the app's proxy route, DevTools never shows the
SAP URL, method, or the full payload. Nothing is hardcoded today — `user_name` is
already resolved from the endpoint/system credentials — but it is invisible.

## What changes

1. **The browser sends the same payload SAP receives.** The Edit dialog first asks
   the server for the resolved SAP user for that endpoint, then posts the complete
   body `{ "edit": { "user_name": "SIPL_QM", "reffld": "100069" } }`. The Request
   Payload panel in Network now matches the SAP payload exactly.
2. **The server honours the payload it is given** (still validating it, and still
   filling in `user_name` from settings if the client did not supply one) — so no
   dummy or hardcoded values, and no behaviour change if the client omits a field.
3. **The SAP call details are attached to the proxy response**, visible in the
   Network → Headers panel:
   - `x-sap-url` — the full SAP URL including query string
   - `x-sap-method` — PUT/POST/GET as configured
   - `x-sap-request` — the exact JSON body sent to SAP (truncated for very large
     bodies such as file uploads; never contains the password)
   - existing `x-sap-status` / `x-sap-latency-ms` stay as they are
4. **The Response tab keeps SAP's verbatim reply** — record JSON, or SAP's plain
   sentence wrapped as `{ "message": "..." }` as it already is.
5. Same treatment for the sibling flows so the whole Reports/My NFAs area behaves
   consistently: detail, MY NFA Select, update, my-update, upload, attachments,
   print and report.
6. **MY NFA Select gets `user_name` too**, resolved the same way as Edit (today it
   only substitutes `reffld`), so both Edit paths send the payload SAP expects.

## Technical notes

- `src/lib/sap-call.server.ts`: extend `SapCallResult` with an optional
  `request: { url, method, body }`, populated in `callSap` for both direct and
  middleware modes (middleware mode reports the resolved SAP target URL, not the
  proxy URL). Password/Authorization never included.
- `src/lib/sap-report.server.ts`:
  - `callEnfaDetail(reffld, overrides?)` — accept an optional caller-supplied
    `edit` object merged over the stored template; `user_name` falls back to the
    resolved credential (uppercased) when absent.
  - `callEnfaSelect` — same merge plus `user_name` injection.
  - Add a small exported helper `resolveSapUserForEndpoint(kind)` used by a server
    function so the client can prefill `user_name`.
- New server function in `src/lib/sap-api.functions.ts` (or the existing report
  functions module) returning `{ user_name }` for a given endpoint kind
  (`detail` | `select`), resolved from Admin → SAP API Settings. No secrets returned.
- `src/routes/api/public/enfa-detail.ts`, `enfa-select.ts`, `enfa-update.ts`,
  `enfa-my-update.ts`, `enfa-upload.ts`, `enfa-attachments.ts`, `enfa-print.ts`,
  `enfa-report.ts`: pass the caller's body through to the SAP helper and add the
  new `x-sap-*` response headers from `result.request`.
- `src/components/report/RecordEditDialog.tsx`: fetch the resolved user once when
  the dialog opens (cached per session) and post the full `{ edit: { user_name,
  reffld } }` body; response handling, field mapping and Save flow unchanged.
- No schema changes, no new endpoints, no hardcoded users or payloads.
