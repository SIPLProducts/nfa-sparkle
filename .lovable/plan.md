# Use the logged-in user's User ID as `user_name` in the Edit payload

## Scope (confirmed)
Edit flow only — the record-load call made when the Edit dialog opens
(`/api/public/enfa-detail` and `/api/public/enfa-select`). All other SAP calls
(Report, Update, Upload, Create, Approvals) keep using the SAP credential from
Admin → SAP API Settings.

## Current behavior
`RecordEditDialog.tsx` resolves `user_name` via the `getSapUserForEndpoint`
server function, which returns the endpoint's stored SAP credential (e.g.
`SIPL_QM`), and posts `{ "edit": { "user_name": "SIPL_QM", "reffld": "…" } }`.

## Target behavior
The payload uses the User ID of whoever is logged in (the same ID typed on the
login screen, stored in `profiles.username`), uppercased:

```text
POST /api/public/enfa-detail
{ "edit": { "user_name": "<LOGGED-IN USER ID>", "reffld": "100069" } }
```

visible verbatim in Inspect → Network, and forwarded unchanged to SAP.

## Changes
1. **`src/components/report/RecordEditDialog.tsx`**
   - Replace the `getSapUserForEndpoint` lookup with a client-side read of the
     current profile: `supabase.from("profiles").select("username").eq("id", user.id)`
     using the session user, cached per session (reuse the existing
     `sapUserCache` pattern, keyed per user id so switching accounts refetches).
   - Send `user_name: <username>.toUpperCase()` in the edit payload for both
     `detail` and `select` endpoints.
   - Fallback only if the profile has no username: keep the current behavior
     (omit/empty so the server fills from the endpoint credential) — no errors,
     no hardcoded IDs.
2. **Server side — no change needed.** `callEnfaDetail`/`callEnfaSelect` already
   honor a caller-supplied `user_name` (they only fall back to the credential
   when it's absent), and the `x-sap-request` header already mirrors the exact
   body sent to SAP.
3. `getSapUserForEndpoint` stays in place (unused by the dialog afterwards) —
   no other callers to disturb.

## Technical notes
- `profiles.username` is the User ID column used by `resolve_login_email` at
  login; RLS lets a user read their own profile row.
- No schema changes, no new endpoints, no changes to Save/Update, attachments,
  or any other screen.
- Verify with `bun run build`, then open Edit on a record and confirm the
  Network request payload shows the logged-in User ID.
