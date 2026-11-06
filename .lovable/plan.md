# Move Approver Selection above Company and Plant

## What changes
On Create NFA, inside the "Organisation & Type" card, the **Approver Selection** choice (Predefined Approvers / Dynamic Approvers) moves to the top, above the Company and Plant fields. It spans the full width, like it does now.

New order in the card:
```text
Approver Selection  [ Predefined ]  [ Dynamic ]
Company             Plant
NFA Type            Function
```

Only one option can be picked at a time. The current control already works this way, so it stays as it is. Predefined stays the default.

## Unchanged
- CHECK stays "X" for Predefined and "" for Dynamic.
- When you switch options, the Plant list still reloads for that option.
- In Dynamic mode, NFA Type and Function are still disabled.
- Approvers, payloads, validations and every other field stay the same.

## Technical details
- `src/routes/_authed.nfa.new.tsx`: move the existing `<Field label="Approver Selection" className="md:col-span-2">…</Field>` block so it sits before the Company `<Field>` in the same grid. Only the markup moves; the state and logic stay the same.
