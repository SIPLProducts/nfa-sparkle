# Fix: approver names empty in Create NFA payload

## Root cause (confirmed)
- SAP's approver chain only returns designation + User ID, so the screen sends `name01`, `name2`… as empty.
- The server then tries to fill names from portal user profiles, but it reads them as the signed-in user. Profile access rules only allow a user to read their own profile, so every other approver's name comes back empty.
- The approvers do have names saved (e.g. 9001 = thiru sharvi, 9002 = prasad sharvi, 1007 = varun yadav).

## Fix
- In the Create NFA server step, look up approver names with the trusted server client, after the caller's sign-in is already verified.
- Read only `username` and `full_name`, only for the approver User IDs in the request.
- Names are filled into `name01`, `name2`…`name15` exactly as now; empty string if a User ID has no portal profile.

## Not changed
- Payload structure, other fields, validations, SAP endpoint, approver selection, profile access rules.

## Technical details
- `src/routes/api/public/enfa-create.ts`: replace `supabase.from("profiles").select(...)` in the name-fill block with `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")` and `.select("username, full_name").in("username", needNames)` (plus case-insensitive match as today).
- Add a test for the name-fill mapping if extracted to a small helper.
