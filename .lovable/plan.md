# Rename Approver Selection options on Create NFA

- "Dynamic Approvers" becomes "Budgeted".
- "Predefined Approvers" becomes "Non Budgeted (Deviation)".

Only these two labels change. The option positions (Budgeted first), the small helper text, the default selection, validations and all approver behaviour stay the same.

## Technical details
- In `src/routes/_authed.nfa.new.tsx`, change the two `<span>` label texts inside the Approver Selection RadioGroup. Values `dynamic`/`predefined` stay unchanged.
