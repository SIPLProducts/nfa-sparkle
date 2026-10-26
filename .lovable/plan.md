# Keep approvers in the order the initiator ticks them

## Problem
On Create NFA, the approvers you tick are currently put back into the list's top-to-bottom order. Ticking the order you choose has no effect. For example, if you tick 9003 and then 9001, the order still comes out as 9001 then 9003.

## Change
- The approvers list will remember the order of your ticks. The first approver you tick becomes Level 1, the second becomes Level 2, and so on.
- Unticking an approver removes it, and the approvers after it each move up one level.
- Each ticked row shows its place in the order (for example "#2"), so you can see the sequence before you submit.
- The existing "Selected sequence" summary will show this same order.
- With Predefined Approvers, the full chain is still ticked automatically in the chain's own order, as it is today.

## Why this keeps the order through the whole approval process
Every later step already uses this selected order:
- the approver list sent to SAP when the NFA is created,
- the per-NFA approver list saved in the app,
- the Dynamic Approvals list,
- workflow emails,
- the Print Form approver grid.

Because the order is fixed at the moment you tick, it stays the same everywhere. The data sent to SAP keeps exactly the same fields; only the levels are filled in your chosen order.

## Technical details
- In `src/components/nfa/ApproverSelector.tsx`, replace the `checked: Set<number>` state with an ordered array `checked: number[]`.
  - Toggling adds a row to the end of the array or removes it from the array.
  - `selected = checked.map(i => levels[i])`, renumbered starting from level 1.
  - The predefined auto-select stays `levels.map((_, i) => i)`.
  - Show the order badge from `checked.indexOf(i) + 1`.
- Add a small test, `src/lib/approver-order.test.ts`, using a pure helper (`orderSelected`, exported from a lib file). It checks that ticking 9003, then 9001, gives levels 1 = 9003 and 2 = 9001, and that unticking renumbers the remaining approvers.
- No changes to APIs, the create payload builder, email routing, or the database.
