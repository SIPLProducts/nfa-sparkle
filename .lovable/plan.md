# Show User ID in the Approvers window

## What changes
- Add a "User ID" column in the Approvers window on Create NFA, between Designation and Approver Name. It shows the SAP User ID for each approver, such as 22004695.
- This works for both Predefined and Dynamic approvers.

## What stays the same
- Selection, order, Selected Sequence, validations, and SAP requests and payloads stay the same. The User ID already comes from SAP and is already sent.

## Technical details
- `src/components/nfa/ApproverSelector.tsx`: add `<th>User ID</th>` and `<td>{a.userId || "—"}</td>` in the approver table.
