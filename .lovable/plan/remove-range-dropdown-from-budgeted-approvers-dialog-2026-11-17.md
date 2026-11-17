# Remove Range dropdown from Budgeted Approvers dialog

- Hide the "Range" dropdown at the top of the Approvers dialog in Create NFA (Budgeted mode).
- The list will automatically use the initiator's own assigned range (current default), so approvers shown stay the same as today: Approver-role users whose range overlaps the initiator's, excluding Admins and the initiator.
- Selection order / levels, the "at least 2 approvers" validation, Predefined mode, APIs and payloads stay unchanged.
- Update the dialog's helper text from "Select approvers from your Series" to "Select approvers from your Range".

## Technical
In `src/components/nfa/ApproverSelector.tsx`, stop rendering `seriesPicker` (keep `seriesFilter` state defaulting to `r.mine`). No server or DB changes.
