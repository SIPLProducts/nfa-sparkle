# Restore User ID login on the self-hosted server

## Confirmed cause in the deployment package

- Email login works directly and does not use the User ID resolver.
- User ID login calls `public.resolve_login_email()` to map `profiles.username` to the account email before checking the password.
- The resolver exists in the local migration `20260812123128_d8d83593-2ea6-464b-b8d4-158984fd1356.sql`.
- That migration is missing from `deployment/Quality/backend/migrations`, so uploading only `dist` cannot make the self-hosted database match local.

## Fix

1. Add a non-destructive, rerunnable Quality migration containing the existing resolver definition and permissions exactly as used locally:
   - keep/add `profiles.username`;
   - keep the case-insensitive unique User ID index;
   - create `public.resolve_login_email(text)` as a security-definer function;
   - grant function execution to login callers.
2. Update the Quality deployment guide with the exact safe sequence:
   - copy the new migration to `Quality/backend/migrations`;
   - run `./scripts/run-migrations.sh`;
   - verify the resolver returns the same email that already logs in;
   - restart the application service only if its server environment was changed (a database-only repair does not require replacing `dist`).
3. Include verification queries that detect missing, blank, or duplicate User ID mappings without deleting or rewriting users.
4. Improve the login resolver’s server-side error handling so a missing/broken database function is distinguishable from genuinely invalid credentials, while keeping the user-facing sign-in behavior secure.
5. Validate both paths with one existing account: Email + password, then User ID + the same password.

## Safety

- No users, passwords, roles, permissions, workflow records, or existing fields are deleted.
- Existing User IDs are preserved; any conflicting mapping is reported for review rather than automatically overwritten.
- No changes are made to unrelated application screens or workflows.
