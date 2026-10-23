# Add Close button and X icon to the Approvers window

## What you will see
- An **X** icon in the top-right corner of the Approvers window.
- A **Close** button next to **Done** at the bottom.
- Both close the window and keep the approvers you ticked, the same way Done does. Pressing Esc also closes the window.

## Not changed
Approver loading, ticks, the minimum of 2 approvers, submit, and every other screen.

## Technical details
- In `src/routes/_authed.nfa.new.tsx` (the custom approvers overlay around line 746):
  - Add an absolutely positioned ghost icon button (lucide `X`, `aria-label="Close"`) that calls `setApproversOpen(false)`.
  - Add an outline "Close" button in the footer.
  - Add an Esc key handler that runs only while the window is open.
