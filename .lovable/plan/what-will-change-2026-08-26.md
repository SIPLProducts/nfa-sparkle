Place the Function field next to the Plant field on the Create NFA screen

## What will change
- In `src/routes/_authed.nfa.new.tsx`, the Function field currently spans the full width (`md:col-span-2`) below the Plant field.
- I will remove that span class so Function sits in the same two-column grid row as Plant, matching the Company / NFA Type layout above it.

## What will stay the same
- Field styling, labels, placeholders, load states, error messages, and retry buttons.
- SAP data fetching for plants and functions.
- All validations, payloads, and existing functionality.
- Every other field on the Create NFA screen.

## Files affected
- `src/routes/_authed.nfa.new.tsx`
