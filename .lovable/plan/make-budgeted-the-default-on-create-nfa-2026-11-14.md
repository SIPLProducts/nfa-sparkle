# Make Budgeted the default on Create NFA

- When Create NFA opens, "Budgeted" is selected.
- After a successful submit, the cleared form selects "Budgeted" again.

Users can still switch to "Non Budgeted (Deviation)". Everything else stays as it is, including what each option does.

## Technical details
- `src/routes/_authed.nfa.new.tsx`: change the initial value of `approverMode` (line 148) and the reset after submit (line 383) from `"predefined"` to `"dynamic"`.
