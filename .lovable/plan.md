# Company Series (Range) in User Management

## What you'll see
- **User Management > Companies** gets two sub-tabs:
  - **Companies**: the current company list, unchanged.
  - **Range**: a table of **Series**, **From** and **To** (all required, and From must not be greater than To), with Create / View / Edit / Delete. It starts with 9000 (9000–9499), 9500 (9500–9980) and 1000 (1000–1500), as in your sheet.
- **Create User / Edit User**: a new **Series** dropdown listing the Series from the Range tab. Edit User shows the user's saved series.
- **Users list**: each user's series shows next to their company.
- Everything else stays the same: the Company field, the details sent to SAP, other checks, and the Create NFA company list.

## Technical details
- New `company_series` table (series unique, range_from, range_to; a trigger checks From <= To). Grants and RLS: signed-in users can read it, and only User Management can write to it. Default rows go in through a data insert.
- New nullable `profiles.company_series` column.
- Add `company_series` to `master-lists.functions.ts` (guarded CRUD) and a small `RangeTab` component. Put nested Tabs inside the Companies tab.
- Create/Edit User saves the series to the profile server-side, after the existing user create or update succeeds. The SAP payload is untouched.
- Tests cover the From/To validation and that the series is saved on create and edit.
