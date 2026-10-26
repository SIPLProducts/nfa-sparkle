# Make Function mandatory on Create NFA

## What you will see
- The Function label shows a red asterisk like Company, NFA Type and Subject.
- Clicking Submit without a Function stops the submission and shows: "Please select a Function before submitting." Everything you entered stays.

## Not changed
SAP calls, payloads, the Function list loading, approver rules and every other screen.

## Technical details
File: `src/routes/_authed.nfa.new.tsx`
- `<Field label="Function">` becomes `<Field label="Function" required>`.
- In `submit()`, after the existing Company/NFA Type/Subject check and before the approver-count check: `if (!func) return toast.error("Please select a Function before submitting.");`
