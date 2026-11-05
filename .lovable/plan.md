# Dashboard status cards: gradient color scheme

Apply the bold gradient style from the reference screenshot (solid colored cards, white text, translucent icon box) to the five cards. Layout, labels, captions, icons, counts and click behavior stay the same.

## Colors (from reference)
- Pending: bright blue gradient (sky to royal blue)
- Approved: green gradient (emerald to teal)
- Rejected: red gradient (rose to crimson)
- Back to Initiator: orange gradient (amber to orange), as the "Under Review" card
- Clarification: violet gradient (indigo-violet to purple), as the "My Submitted" card

## Styling
- Card fill: diagonal gradient per status, rounded corners, soft colored shadow
- Label, count and caption in white (caption slightly faded)
- Icon in a white translucent rounded box
- Remove the left color strip (not in the reference)

## Technical details
- `src/styles.css`: add per-status gradient start/end tokens and `--shadow-status-*` tokens.
- `src/routes/index.tsx`: update only `KPI_TONES` and the `Kpi` card classes to use the gradient tokens; no change to counts, links or data.
