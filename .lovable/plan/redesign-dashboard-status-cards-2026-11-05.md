# Redesign Dashboard Status Cards

## What changes
Replace the current five top cards with five new status cards, in this order:

| Card | Count shown | Click goes to | Color / icon |
|---|---|---|---|
| Pending | NFAs waiting for my approval (same number as today's "Pending With Me") | Approvals | Blue, inbox icon |
| Approved | My NFAs fully approved (same as today) | — | Green, check icon |
| Rejected | My NFAs rejected (same as today) | — | Red, cross icon |
| Back to Initiator | My NFAs sent back to me | My NFAs | Amber, undo-arrow icon |
| Clarification | My NFAs under clarification | My NFAs | Violet, question icon |

"My Submitted NFAs" and "NFAs Under Review" cards are removed from the top strip (the worklists below are unchanged).

## New look
- Clean white card with a rounded corner, soft shadow and a thin colored accent bar on the left.
- Colored icon badge on the right, label in small uppercase grey text, large bold count in the status color.
- Small caption under the count (e.g. "Awaiting your action", "Returned for changes").
- Gentle lift on hover for clickable cards.
- Layout: 1 column on phones, 2 on small tablets, 3 on tablets, 5 in one row on desktop; works in light and dark mode.

## Technical details
- Only `src/routes/index.tsx` (the KPI strip + `Kpi` component) and status color tokens in `src/styles.css` change.
- Back to Initiator / Clarification counts are read from the already-loaded `mine` list (`status === "with_initiator"` / `"clarification"`); no new queries, no changes to data loading, Pending logic, or other counts.
- Colors defined as semantic tokens (`--status-pending`, `--status-approved`, etc.) instead of hardcoded classes.
