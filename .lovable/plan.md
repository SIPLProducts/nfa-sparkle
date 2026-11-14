# Swap Approver Selection order on Create NFA

Show "Dynamic Approvers" first and "Predefined Approvers" second in the Approver Selection radio group.

## What changes
- Only the display order of the two options swaps.
- The default selection stays the same. Validations, the approver lists, the SAP calls and the saved data all stay the same.

## Technical details
- In `src/routes/_authed.nfa.new.tsx` (lines 543–562), move the `approver-mode-dynamic` `<label>` block above the `approver-mode-predefined` block. No other edits.
