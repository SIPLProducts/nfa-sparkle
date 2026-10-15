# Select approvers while creating an NFA (screen only)

## What you will see
- On Create NFA, once Project, NFA Type and Function are chosen, an **Approvers** section lists the approvers configured in the Approval Chain for that combination, in their configured order.
- Each row shows Level, Designation, User ID and Email ID (email from User Management), with a checkbox.
- All approvers are ticked by default, so nothing changes unless the initiator unticks some (for example, picks 3 of 5).
- The selected approvers are shown renumbered in sequence (Level 1, 2, 3...) as a summary, keeping the configured order.
- At least one approver must stay selected; otherwise a message asks the initiator to select one.
- If no chain is configured, the section shows "No approval chain configured" and Create works as today.

## Not included in this step
- SAP routing, Create request contents, saved records, Print Form and approval actions stay unchanged. These will be connected once SAP confirms how it accepts the selected approvers.

## Technical details
- In `src/routes/_authed.nfa.new.tsx`, use the existing `fetchSapApprovalChain` with the selected project/function to load levels, and the existing `resolveApprovalUserEmails` lookup for emails (it currently requires User Management access; add a reader allowing Create NFA access so initiators can see emails).
- Keep selection in local state only; no database or SAP payload change.
