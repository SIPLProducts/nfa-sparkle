# Make Plant required on Create NFA

## What changes
- The Plant label gets a red required star, matching the other required fields.
- Submitting without a Plant is blocked. A "Plant is required" message appears under the field and as a pop-up message. The message clears as soon as a plant is picked.
- This applies to both Predefined and Dynamic.

## What stays the same
- Plant list loading, SAP requests, payloads, approver lookup and all other checks stay the same.

## Technical details
- `src/routes/_authed.nfa.new.tsx`: `<Field label="Plant" required>`; add `plantError` state; in `submit()` check `!plant` before the existing `missingCreateFields` call (set error + toast, return); clear on plant change.
- Add a small test in `src/lib/nfa-required-fields.test.ts` only if the check moves into the shared helper; otherwise keep the helper unchanged.
