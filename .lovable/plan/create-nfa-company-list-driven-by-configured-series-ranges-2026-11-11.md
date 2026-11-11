# Create NFA Company list driven by configured Series ranges

## What changes
- Create NFA → Company will list every active company whose code falls inside the **From–To range of the user's assigned Series**, as configured in User Management → Company → Series.
- Example: if Series 9000 is set to 1000–9990, the user sees all companies from 1000 to 9990, including 9101.
- Editing a range in the Series tab takes effect the next time Create NFA is opened — no code change needed.
- The four fixed ranges built into the app (9000–9499, 9500–9599, 1000–1999, 4000–4199) are removed as the source of truth.

## How the user's series is found
1. The user's saved Company Series (set in Create/Edit User).
2. If blank (older users), the configured range that contains the user's company code.
3. If nothing matches, the list is empty (same as today).

## Unchanged
- Company dropdown, required validation, Plant/Approver loading, SAP payloads, Company Master, and all other screens.

## Technical details
- `src/lib/company-groups.ts`: replace hardcoded `COMPANY_GROUPS` with pure `pickSeriesRange(userSeries, userCode, ranges)` and `filterCompaniesByRange(range, companies)` (numeric, sorted).
- `src/lib/my-companies.functions.ts`: read `profiles.company_code, company_series` and `company_series` rows server-side, then filter.
- Update `company-groups.test.ts`: 1000–9990 includes 9101; fallback by company code; no match → empty; range edits respected.
- Update the company-groups memory note to say ranges come from the Series tab.
