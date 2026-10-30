# Dynamic Approvers: make NFA Type and Function optional

## What changes (Create NFA screen only)
- When **Dynamic Approvers** is selected:
  - NFA Type and Function dropdowns are disabled and their red `*` is hidden.
  - Any value already picked in them is cleared, so nothing stale is sent.
  - Submit no longer requires NFA Type or Function. Company, Subject and the minimum approver count are still required.
- When **Predefined Approvers** is selected: no change. Both fields stay enabled and mandatory, exactly as today.
- Switching back to Predefined re-enables both fields (empty, user picks again).

## Not changed
- The SAP create payload, approver lookup calls, email workflow and all other screens. In Dynamic mode the existing payload simply sends NFA Type/Function as empty values, which it already does when they are blank.

## Technical details
File: `src/routes/_authed.nfa.new.tsx`
- Add `const isDynamic = approverMode === "dynamic"`.
- `submit()`: require `nfaType` and `func` only when `!isDynamic`; keep Company/Subject/approver checks. Adjust the error message per mode.
- NFA Type `<Field required={!isDynamic}>`, `<Select disabled={isDynamic || ...existing}>`; same for Function.
- `useEffect` on `approverMode`: when dynamic, `setNfaType("")` and `setFunc("")` (the existing Function effect already clears functions when NFA Type is empty).
- Add a small test for the mode-based required-field rule alongside existing tests in `src/lib`.
