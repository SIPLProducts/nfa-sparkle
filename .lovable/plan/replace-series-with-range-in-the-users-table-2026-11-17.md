# Replace Series with Range in the Users table

## What changes
- Users table: the "Company" column currently shows the series code (e.g. 9101) as its main value. Rename the column to **Range** and show only the user's range (e.g. "1000–9990"), or "—" when none is assigned.
- Company name / employee info that was stacked under the series code moves out of that cell (company name stays visible only where it's still meaningful, e.g. a small sub-line under the range if the user had no range).
- Search, sorting, Create/Edit User, Range tab and Create NFA approver logic stay as they are (they already use Range).

## What stays the same
- The stored value and what SAP receives (COMPANY_CODE / SERIES) are unchanged, so no payload or business logic changes.
- No database change.

## Technical details
- `src/routes/_authed.admin.users.tsx`: header "Company" -> "Range"; cell renders `rangeOf(u.company_series)` (fallback: range containing `company_code`, else "—").
- Quick scan of other admin screens for leftover visible "Series" labels and rename to "Range".
