# Show Department, Designation and Approver Name in the Approvers list

## What changes
In the Approvers list on Create NFA (both Dynamic and Predefined), each approver row will show:
- **Department Name** — from the approver's portal user profile (matched by User ID)
- **Designation** — as returned by SAP today (unchanged source)
- **Approver Name** — the approver's full name from their portal user profile

Column order: NFA Type / Function, Level, Department Name, Designation, Approver Name, User ID, Email ID. User ID and Email ID stay. A blank value shows "—".

The "Selected sequence" chips will also show the name, e.g. `Level 1: 22012284 – Ranjith Kumar (SCM HEAD)`.

## What does not change
- SAP approval-chain request, the Create ENFA payload, approver selection order, levels, and the "at least N approvers" check.
- The existing email lookup.

## Technical details
- Add a new read-only server function `resolveApprovalUserDetails` in `src/lib/approval-chain.functions.ts`, same access guard as `resolveApprovalUserEmails` (user_management or nfa_new), returning `{ [userId]: { name, department } }` from `profiles` (`full_name` or first+last, `department`), skipping DELETED users.
- In `src/components/nfa/ApproverSelector.tsx`, call it alongside the email lookup in the same effect, store in state, and render the two new columns. The `name` passed to `onChange` stays as today so payloads are untouched.
- SAP's chain response only carries designation and user ID per level, so name and department come from User Management profiles.
