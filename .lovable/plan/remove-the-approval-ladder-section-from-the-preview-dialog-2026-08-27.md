Remove the Approval Ladder section from the Preview dialog.

What
- In `src/components/report/RecordPreviewDialog.tsx`, remove the `<section>` that renders the "Approval Ladder" table (levels L1–L6).
- Keep all other sections and behavior intact: PDF viewer, loading/error states, Detailed Description, and dialog footer actions.

Why
- The user asked to remove only this section and explicitly said not to affect other fields, sections, or functionality.

How
1. Read `src/components/report/RecordPreviewDialog.tsx` (already confirmed content).
2. Delete lines 182-210 (the Approval Ladder `<section>`), preserving the surrounding fragment/conditional structure.
3. Run the build/typecheck to verify no errors are introduced.
4. Confirm the Preview dialog no longer renders the Approval Ladder table.