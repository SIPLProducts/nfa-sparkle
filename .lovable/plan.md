# Upload API payload updated

Align the saved Upload body templates in SAP API Settings with the required payload and confirm the runtime sends `user_name` dynamically, visible in Inspect → Network.

## Current state (verified)

- Both upload endpoint rows exist and are active, method PUT:
  - **Upload Document** (`bad2146a…`) and **Attached Docs In MY NFA** (`95b4a593…`)
  - Both templates still contain a hardcoded `"user_name": "SIPL_QM1"`.
- `src/lib/sap-report.server.ts` → `callEnfaUpload` (line ~951) already overrides the template's `user_name` with the resolved user, upper-cased, at call time — nothing is hardcoded in code.
- `src/routes/api/public/enfa-upload.ts` already returns `x-sap-url`, `x-sap-method`, and `x-sap-request` response headers, so the exact payload sent to SAP is visible in Inspect → Network.

## Changes

1. **Migration** — update `sap_endpoint.request_body` for the two upload rows (matched by name, idempotent) to:

```json
{
  "upload": {
    "user_name": "",
    "reffld": "",
    "file": [
      {
        "file_name": "enfa.pdf",
        "file": ""
      }
    ]
  }
}
```

The blank `user_name`/`reffld`/`file` are placeholders — the runtime injects the dynamic values on every call. Path, method (PUT), headers, query, credentials and Active flags stay untouched.

2. **Verification** — run an upload from the Reports toolbar (and from Attached Docs) in the preview and confirm in Inspect → Network that the `x-sap-request` header shows `{ "upload": { "user_name": "<resolved user>", "reffld": "<ENFA no>", "file": [ { "file_name": "...", "file": "<base64>" } ] } }` and the response shows SAP's `STATUS` / `MESSAGE` / `ENFA_NO`.

## Technical notes

- No code changes required: `callEnfaUpload` already merges the stored template, injects `user_name`/`reffld`/`file` dynamically, and the proxy route already exposes the payload via `x-sap-*` headers.
- No UI, filters, or other endpoints change.
