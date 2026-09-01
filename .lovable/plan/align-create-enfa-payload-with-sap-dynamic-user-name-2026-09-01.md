# Align Create ENFA payload with SAP (dynamic `user_name`)

Make the Create NFA submission send SAP's exact `{ "create": { ... } }` payload — starting with `user_name` taken from the logged-in user — and make the API Settings screen show/manage that same template. No hardcoded values.

## Current state (verified)

- `wrapCreatePayload` in `src/lib/sap-api-constants.ts` builds `{ create: {...} }` from `CREATE_WIRE_KEYS` = CC_code, PSPNR, NAME1, FUNCT, EXTR_TXT, SUBJECT, SCOPE_IMPACT, BUDGET_IMPACT, TIMELINE_IMPACT, TEXT, plus `file[]`. **`user_name` is missing.**
- `src/routes/_authed.nfa.new.tsx` posts the same 10 fields + files to `/api/public/enfa-create`; it never resolves the logged-in User ID.
- `src/routes/api/public/enfa-create.ts` already forwards `x-sap-url`, `x-sap-method`, `x-sap-request`, `x-sap-status` headers, and `callEnfaCreate` already reads host/path/method/auth from the "Create ENFA" endpoint row.
- Report / Approvals / My NFAs already resolve `profiles.username` into `user_name` with a per-session cache — same pattern applies here.
- API Settings detail screen (`_authed.admin.sap-api.$id.tsx`, Request tab) has a free-text "Body template (JSON)" field with a generic placeholder.

## Changes

1. **`src/lib/sap-api-constants.ts`**
   - Add `user_name` as the first entry in `CREATE_WIRE_KEYS`.
   - Add `wrapCreatePayload(flat, files, userName?)` so the server can inject the resolved User ID; export a `CREATE_BODY_SAMPLE` string containing the exact payload shape (empty values) for use as the settings placeholder.

2. **`src/routes/_authed.nfa.new.tsx`**
   - Resolve the logged-in user's `profiles.username` (uppercased, cached per session, same helper pattern as Approvals) and include it as `create.user_name`.
   - Keep every other field, validation, attachment and local-save behaviour unchanged.

3. **`src/routes/api/public/enfa-create.ts`**
   - Pass the browser-sent `user_name` through `wrapCreatePayload` so the outgoing SAP body matches byte-for-byte what the client sent; if absent, fall back to the caller's profile username resolved server-side.
   - Continue wrapping non-JSON SAP replies so the UI never hits a parse error.

4. **`src/routes/_authed.admin.sap-api.$id.tsx`**
   - Use the shared create sample as the Body-template placeholder for the Create ENFA endpoint, plus an "Insert sample payload" action that fills the template with the exact key list (values blank). Templates stay editable and drive the call.

## Network visibility

The Create NFA request keeps sending the real payload to `/api/public/enfa-create`, and the response carries `x-sap-url`, `x-sap-method`, `x-sap-request` (the exact JSON sent to SAP) and `x-sap-status`, so Inspect → Network shows the true SAP URL, method, payload and response body.
