# Fix "Forbidden: admin role required"

## What's wrong

The admin check in the SAP API Settings and User Management server code calls a database
function named `has_role`. That function does not exist in the database (verified: the only
functions present are `nfa_act`, `nfa_resubmit`, `get_profiles_basic`, `resolve_users_by_email`,
plus triggers). Every call therefore returns an error and the code treats that as "not an admin",
so every admin action — creating an endpoint, saving a SAP system, saving middleware config,
creating users/roles — fails with "Forbidden: admin role required", even though your account
does hold the `admin` role in `user_roles`.

## The fix

One database migration that creates the missing role-check function:

- `public.has_role(_user_id uuid, _role text) returns boolean` — security definer, stable,
  `search_path = public`.
- It returns true when the user has the role in `user_roles` (built-in roles) **or** in
  `user_role_assignment` (custom roles created in User Management), so both role systems work.
- Execute permission granted to `authenticated` (and `service_role`); revoked from `anon`.

No application code changes are needed — the existing `assertAdmin()` calls will start
succeeding immediately.

## After the migration

Reload the SAP API Settings page and register the "Reports Fetch" endpoint again; the
Forbidden toast should be gone. I'll also confirm User Management saves work.
