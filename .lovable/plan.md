# Create NFA: Company dropdown limited to the user's company group

## Goal
The Company dropdown on Create NFA lists only the companies in the signed-in user's company group. The list comes from the web Company Master and shows as "9000 – Ramky Estates & Farms".

## Company groups
| User's saved company code | Companies shown |
|---|---|
| 9000–9499 | 9000–9499 |
| 9500–9599 | 9500–9599 |
| 1000–1999 | 1000–1999 |
| 4000–4199 | 4000–4199 |
| No company saved, or a code outside these ranges | None. The dropdown reads "No companies assigned to your user". |

Only active Company Master entries are shown, sorted by company code.

## Not changed
- Selecting a company still loads plants from SAP, as it does today.
- The values sent to SAP, the validations, and every other field on the form stay the same.
- The User Management Company dropdown is not changed.

## Technical details
- New pure helper `src/lib/company-groups.ts`: `companyGroupFor(code)` returns the range, and `filterCompaniesForUser(userCode, companies)` applies it. Unit tests cover all four ranges, a user with no company, and a code outside every range.
- New server function `listMyCompanies` (requires sign-in, guarded by Create NFA screen access):
  - reads the caller's `profiles.company_code`;
  - reads active `companies` rows;
  - returns `{ code, name }[]` filtered by the helper.
- `src/routes/_authed.nfa.new.tsx`: the company-loading effect calls `listMyCompanies` instead of the SAP Company F4 endpoint. The placeholder text and error text are updated. Everything else on the form is untouched.
- Record the range rule in project memory.
