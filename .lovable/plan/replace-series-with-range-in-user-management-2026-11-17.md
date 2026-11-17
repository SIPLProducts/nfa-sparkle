# Replace Series with Range in User Management

## What changes
- **Companies > Range tab**: remove the Series column, search and form field. Each row is just **From** and **To** (e.g. 1000–1999). Button reads "Create range". View/Edit/Delete stay.
- **Create / Edit User**: the "Company Series" field becomes **Range**, listing options like "1000–1999", "1000–9990". Required validation stays. Users list shows the range instead of the series.
- **Create NFA Company list**: still shows companies whose code falls inside the user's assigned From–To range (unchanged behavior).
- **Budgeted approvers**: lists active users with the **exact same range** as the creator, excluding Admins and the creator. The filter dropdown lists ranges instead of series. Level-wise ordering unchanged.
- Users already assigned a series are automatically moved to that series' range, so nobody loses their assignment.

## Unchanged
SAP calls, NFA payloads, roles, permissions, validations, and all other screens.

## Technical details
- Migration (additive): add `profiles.company_range_id uuid` referencing `company_series.id`; backfill from existing `profiles.company_series`; unique constraint on `(range_from, range_to)`; mark `company_series.series` and `profiles.company_series` as deprecated (keep columns; make `series` nullable/defaulted from range_from so existing rows/triggers keep working).
- Update `company-series.functions.ts`, `_authed.admin.users.tsx` (Range tab + user forms), `user-admin.functions.ts`/`user-admin.server.ts` (save range id), `my-companies.functions.ts`, `series-approvers.ts`/`.functions.ts` (match by range id) and the Budgeted selector filter.
- Update `series-approvers.test.ts` for same-range matching; run tests.
- Update project memory: company list and approvers follow the user's assigned Range.
