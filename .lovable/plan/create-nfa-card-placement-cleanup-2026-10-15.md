# Create NFA — Card Placement Cleanup

Improve only the arrangement, spacing and alignment of the cards on the Create NFA screen. No functionality, API calls, payloads or business logic change.

## Current layout

- Page is a 3-column grid on large screens:
  - Left (2/3 width): **Organisation & Type**, then **Note Details**
  - Right (1/3 width): **Document Attachments**, then **Approvers**
- Cards use the shared `Section` wrapper (icon + title + description header, padded body).

## Planned changes (file: `src/routes/_authed.nfa.new.tsx` only)

1. **Consistent spacing** — use a uniform `gap-6` between the two columns and `space-y-6` between stacked cards, so every card has the same breathing room.
2. **Aligned card tops** — both columns start at the same vertical position; the right column uses `self-start` so its cards align cleanly with the left column's first card.
3. **Sticky right column on wide screens** — Document Attachments and Approvers stay visible (`lg:sticky lg:top-4`) while scrolling the long left column; on phones everything stacks in one column as today.
4. **Balanced grouping order** (workflow order, unchanged content):
   - Left: Organisation & Type → Note Details
   - Right: Document Attachments → Approvers (kept below the upload box, as previously requested)
5. **Card polish (placement-level only)** — keep the existing `Section` card style; only tidy the right column's nested wrapper (remove the extra nested div) so indentation and spacing are clean and consistent.
6. **Responsive behavior** — single-column stacking on small screens in the same order: Organisation & Type → Note Details → Document Attachments → Approvers → Submit.

## What stays exactly the same

- All fields, dropdowns, the Detailed Description editor, file upload behavior, ApproverSelector logic and its SAP calls.
- The Submit button and header actions.
- All SAP integrations, payloads and validation.
- Every other screen.

## Technical details

- Single file edited: `src/routes/_authed.nfa.new.tsx` (className/JSX structure only).
- No new components, no removed components, no state or handler changes.
- Verify with a build plus a browser check of `/nfa/new` at desktop and mobile widths.
