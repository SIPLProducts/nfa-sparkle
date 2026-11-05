Replace the NFA Status Report card with a doughnut chart

What changes on the dashboard
- The "NFA Status Report" card (search, filters, Ongoing/Completed tabs, table, paging) is removed from the dashboard.
- In its place, a card titled "NFA Status Overview" with a doughnut chart showing five slices: Pending (blue), Approved (green), Rejected (red), Back to Initiator (orange), Clarification (violet), matching the colors of the top cards.
- The total count sits in the center of the doughnut; a legend beside it (below on small screens) lists each status with its count and percentage. Hovering a slice shows its name and count.
- The "Full report" link stays in the card header so the detailed list remains one click away on the Report page.
- If every count is zero, the card shows a neutral empty ring with "No NFAs yet".

What stays the same
- Counts use exactly the same numbers already shown on the top cards (same data, no new requests).
- Top cards, Quick actions, other dashboard sections, the Report page and all SAP calls are untouched.

Technical details
- Edit only `src/routes/index.tsx`: swap the status report section for a new chart section using the existing `recharts` package (PieChart with inner radius), colors from existing status tokens in `src/styles.css`.
- Remove the now-unused filter state/helpers for that card only.
