# Why SAP API Settings isn't visible

## What's happening

The screen was built and its routes exist (`/admin/sap-api` and the endpoint detail page). It does not appear in your sidebar because that section is gated to the **admin** role, and the only account in the system — `demo@nfa.local` — currently has just the **initiator** role. The server functions behind the screen also reject non-admin callers, so even opening the URL directly would fail.

## Fix

1. Grant the `admin` role to `demo@nfa.local` in the roles table (keeping the existing `initiator` role), so the Admin section appears in the sidebar and the SAP API server functions accept the calls.
2. Verify after sign-out/sign-in refresh: the sidebar shows **Admin → SAP API Settings**, the APIs / SAP Connection / Middleware tabs load, and the endpoint detail page opens.

## Technical details

- Role check: `hasRole("admin")` in `src/components/AppShell.tsx`, backed by `roles` loaded from `public.user_roles` in `src/lib/auth-context.tsx`.
- Change is a one-row migration inserting `(user_id of demo@nfa.local, 'admin')` into `public.user_roles`; no schema or UI code change needed.
- Optional: if you'd rather not make the demo user an admin permanently, I can instead add a role-management UI later — but for now the screen simply needs an admin account to be reachable.
