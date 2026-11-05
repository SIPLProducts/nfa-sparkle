# Replace dashboard status cards with a Doughnut Chart

## What changes
- Remove the five colored status cards at the top of the dashboard.
- Add one "NFA Status Overview" panel with a **doughnut chart** (cleaner than a pie and leaves room for the total in the center).
- Slices: Pending (blue), Approved (green), Rejected (red), Back to Initiator (orange), Clarification (violet) — the same colors used now.
- Center of the ring shows the total count.
- Beside the chart (below it on small screens), a legend lists each status with its color dot, count and percentage. Pending is clickable to Approvals, Back to Initiator and Clarification to My NFAs, same as the cards today.
- Hovering a slice shows a tooltip with the status and count.
- If every count is zero, show a light grey empty ring with "No NFAs yet".

## What stays the same
- The counts come from the same numbers already calculated on the page; no change to data loading, SAP calls or business rules.
- Everything else on the dashboard is unchanged.

## Technical details
- `src/routes/index.tsx`: replace the `<Kpi />` row with a new `StatusDoughnut` component using the already-installed `recharts` (PieChart with innerRadius) and existing color tokens from `src/styles.css`; remove the unused `Kpi` component.
- Responsive: chart + legend side by side on desktop, stacked on mobile.
