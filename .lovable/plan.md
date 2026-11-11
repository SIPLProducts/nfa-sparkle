# Company Series (Range) in User Management

## What you'll see
- **User Management > Companies** now has two sub-tabs:
  - **Companies**: the current company list, exactly as it is today.
  - **Range**: a table with **Series**, **From** and **To** (all required), with Create / Edit / Delete. It starts with 9000 (9000–9499), 9500 (9500–9980) and 1000 (1000–1500), as in your sheet.
- **Create User / Edit User**: the Company field becomes **Company Series**, a dropdown of the Series from the Range tab. It is still required. When you edit a user, their saved series is already selected.
- **Create NFA**: the Company list shows the companies whose code falls inside the signed-in user's series (for example, series 9500 shows companies 9500–9980). If no range matches, the current fixed groups still apply.

## Technical details
- New `company_series` table (series text unique, range_from int, range_to int, From ≤ To checked by a trigger), with grants and RLS: signed-in users can read it, and only User Management can change it. Default rows go in through a data insert.
- Add `company_series`, plus guarded CRUD, to `master-lists.functions.ts`. Add a small `RangeTab` component, and put nested Tabs inside the Companies tab content.
- In Create/Edit User, the chosen series goes into the existing `COMPANY_CODE` field, so the SAP payload and the profile `company_code` stay the same.
- `company-groups.ts` gets a `rangeFor(code, ranges)` helper. `listMyCompanies` loads the ranges and falls back to the hardcoded groups. Tests cover the 9000/9500/1000 ranges and the fallback.
