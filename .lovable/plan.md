# Company Name from SAP F4 in User Management

Replace the free-text Company Name field with a dropdown fed live by the existing SAP Company F4 service (`GET /e-nfa/enfa_report/create?sap-client=300` with body `{ "cc_code": "" }`), in both the Create user and Edit user dialogs.

## What changes

- Company Name becomes a searchable dropdown listing SAP companies as `BUKRS – BUTXT`.
- The list loads when the dialog opens, with "Loading companies…" state and, on failure, an inline SAP error message plus a Retry link. No static/hardcoded company values are used.
- Edit user pre-selects the user's currently stored company when it matches a row from SAP.
- Payload gains a separate company code key:
  - `EMP_ID` continues to carry the company **name** (BUTXT)
  - new `COMPANY_CODE` carries the company **code** (BUKRS)
  Both are mapped dynamically from the F4 response.
- Everything else in both dialogs (fields, order, validation, roles, password rules, other API keys) stays unchanged.

## Technical details

- Reuse the existing authenticated proxy `POST /api/public/sap-company` and `parseCompanyF4` from `src/lib/sap/master.ts`. No new SAP endpoint row, no change to `sap-report.server.ts` or the Company F4 configuration in Admin → SAP API Settings.
- `src/routes/_authed.admin.users.tsx`: shared `useCompanyOptions()` hook (fetch + loading/error/retry) used by `CreateUserDialog` and `EditUserDialog`; the Company Name `Input` is replaced by a `Select`, keeping the existing `employeeId` state for the name plus a new `companyCode` state.
- `src/lib/user-admin.functions.ts` / `src/lib/user-admin.server.ts`: accept an optional `COMPANY_CODE` and persist it alongside the existing company name; create/update paths otherwise unchanged.
- Migration: add nullable `company_code text` to `public.profiles` (existing profile policies already cover it).
- Create NFA's company dropdown and all other SAP integrations are untouched.
