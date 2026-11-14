# Budgeted: approvers from User Management, filtered by the company's Series

## What you'll see
- For **Budgeted**, the Approvers box lists portal users from User Management once you pick a Company. The list includes only users whose Company Series matches the Series range that the selected Company falls in.
- Users with the Admin role are never listed. Every other role is listed.
- Each row shows Department Name, Designation, User ID and Name. You tick approvers in the order you want them; that order sets the approval levels, as it does today.
- **Non Budgeted** (Approval Chain), the submit request, minimum approver checks and all other screens stay unchanged. No SAP Dynamic Approvers call is made.

## Technical details
- New authenticated server function `listSeriesApprovers` in `src/lib/series-approvers.functions.ts`, using Create NFA screen permission:
  - Input: company code.
  - Server-side admin read: load `company_series` and find the row where `range_from <= code <= range_to`. If ranges overlap, use the narrowest one.
  - Return active profiles whose `company_series` equals that series, excluding users with the admin/custom_admin role in `user_role_assignment` or `user_roles`.
  - Return id, username (SAP User ID), full_name, department and designation.
- `ApproverSelector.tsx`: add an optional `company` prop. In non-predefined mode, call the new function and map each user to a level row (userId = username, role = designation), with selection-ordered levels. The existing name and email resolution fills the payload name slots without changes. The predefined branch stays untouched.
- `_authed.nfa.new.tsx`: pass `company={company}` only.
- Pure helper `pickCompanySeries(code, ranges)` with tests: in-range, out-of-range and narrowest match. Also a test that admins are excluded.
- No migration and no API payload changes.
