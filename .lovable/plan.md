Restyle the Quick actions and Pending your approval cards

Look (matching the colored top cards)
- Both cards: rounded-xl corners, soft shadow, a thin colored strip along the top (blue for Quick actions, the Pending blue/indigo for Pending your approval), and a small gradient icon badge next to each title (Zap for Quick actions, Inbox for Pending).
- Pending card shows its count as a colored pill next to the title instead of "(0)" in the subtitle text; "View inbox" becomes a small soft button.
- Quick action rows: each gets its own colored gradient icon tile (Create = blue, Edit = violet, Approvals = green, Report = orange), rounded-lg row, gentle lift and border tint on hover, arrow slides right on hover.
- Pending rows: rounded hover background, a small "L1/L2" level chip, same Open button.
- Empty state: centered check-circle icon in a soft green circle with "You're all caught up." and a short hint line.
- Both cards stretch to equal height on desktop; spacing and title typography match the Status Overview card.

Unchanged
- Same links, same pending items and count, same Open buttons, layout positions and responsive stacking. No data or logic changes.

Technical details
- Edit `src/routes/index.tsx` (the two sections, `QuickAction`, `EmptyRow`) and add a few `@utility` gradient/shadow helpers in `src/styles.css` reusing the existing kpi gradients.
