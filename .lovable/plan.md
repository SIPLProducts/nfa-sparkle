# Reorder Create NFA fields

## Goal
In the NFA Creation screen, rearrange the "Organisation & Type" section so the field order reads: **Company → Plant → NFA Type → Function**.

## Current state
The two-column grid currently shows:
- Row 1: Company | NFA Type
- Row 2: Plant | Function

## Change
File: `src/routes/_authed.nfa.new.tsx`

Move the `Plant` field into the first row beside `Company`, and move `NFA Type` into the second row beside `Function`.

```text
Before:                 After:
┌─────────┬──────────┐  ┌─────────┬──────┐
│ Company │ NFA Type │  │ Company │ Plant│
├─────────┼──────────┤  ├─────────┼──────┤
│ Plant   │ Function │  │ NFA Type│ Func │
└─────────┴──────────┘  └─────────┴──────┘
```

- Keep all existing labels, placeholders, loading/error/Retry states, disabled logic, and data dependencies unchanged.
- Keep the existing two-column responsive grid (`grid-cols-1 md:grid-cols-2`).
- Do not change state variables, API calls, payload keys, or validation.

## Out of scope
No changes to APIs, payloads, validation rules, field labels, or any other screen.
