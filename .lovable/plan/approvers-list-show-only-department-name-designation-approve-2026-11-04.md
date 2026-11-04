# Approvers list: show only Department Name, Designation, Approver Name

## What changes
In the Approvers list on Create NFA, each row will show only:
- Department Name
- Designation
- Approver Name

These columns are removed from the screen: NFA Type / Function, Level, User ID and Email ID.

The selection tick box and its #1, #2 order badge stay, because you need them to pick approvers and set their order. The "Selected sequence" chips will read `Level 1: Pradeep A (CFO)` and no longer show the User ID.

## What does not change
- The data loaded from SAP, the Create ENFA request (User IDs, levels and names are still sent), how the order works, and the minimum-approvers check.

## Note
Department shows "—" today because those approvers' users in User Management have no Department saved. Once a department is added to each user, it will appear here.

## Technical details
- `src/components/nfa/ApproverSelector.tsx`: remove the table headers and cells for group, level, user ID and email. Keep the email lookup call so behaviour stays the same. Update the chip text. Make the checkbox aria-label use the approver's name and fall back to the user ID.
