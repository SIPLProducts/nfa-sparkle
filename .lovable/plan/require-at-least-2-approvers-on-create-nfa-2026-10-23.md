# Require at least 2 approvers on Create NFA

## What changes for you
- **On Submit:** if fewer than 2 approvers are ticked, the form isn't sent to SAP. An error message appears instead: "Please select at least 2 approvers before submitting." Nothing you've entered is lost.
- **In the Approvers window:** the red hint under the list changes from "Please select at least one approver." to "Please select at least 2 approvers." It shows whenever 0 or 1 approver is ticked.
- **On the Approvers card:** the count ("1 selected") turns red while fewer than 2 are ticked.

## Not changed
The required-field checks for Company, NFA Type and Subject, the approver payload sent to SAP, and all other screens.

## Technical details
- `src/lib/sap-api-constants.ts`: add `MIN_CREATE_APPROVERS = 2`.
- `src/routes/_authed.nfa.new.tsx`, `submit()`: after the existing required-field check, add `if (selectedApprovers.length < MIN_CREATE_APPROVERS) return toast.error(...)`. Make the count turn red.
- `ApproverSelector.tsx`: use the constant in its hint.
- Add a test asserting the minimum is 2.
