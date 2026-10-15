# Remove the Load Sample button from the Create NFA screen

## What changes

On **Create NFA**, the header action bar currently shows **Load Sample** and **Submit**. The **Load Sample** button will be removed, leaving only the blue **Submit** button at the right of the header — positioned the same way, so the header does not look empty or shifted.

Nothing else on the screen changes:

- Company / Plant / NFA Type / Function selectors, Note Details, the rich-text **Detailed Description** editor and its expand view, Document Attachments, and the **Approvers** card all behave exactly as before.
- Submit, draft saving, attachment upload, and every SAP request payload are untouched.
- Print Form remains where it is today: **My NFAs → Edit** and **Approvals**.

## Technical details

All edits are in `src/routes/_authed.nfa.new.tsx` (frontend only, no database or SAP changes):

1. Delete the `Load Sample` `<Button>` from the `PageHeader` `actions` row, and change the wrapper's mobile layout from a two-column grid to a single column so **Submit** keeps its full-width, right-aligned placement on small screens.
2. Delete the now unreachable `loadSample()` function (the block that pre-fills demo subject, scope, budget, timeline, description and approver levels) along with the `Sparkles` icon import that only served that button.
3. Leave every state setter it used (`setCompany`, `setNfaType`, `setFunc`, `setSubject`, `setScope`, `setBudget`, `setTimeline`, `setDesc`, `setApprovers`) untouched — they are all still used by the live form fields and the submit flow.

## Verification

- Type-check and build pass with no unused-import or layout errors.
- Browser check with the signed-in preview session: Create NFA header shows only **Submit**; no "Load Sample" text anywhere on the page; the form fields, Detailed Description editor, Document Attachments and Approvers card still render and update; Submit still runs the normal flow.
- Confirm the header looks correct at both desktop and narrow widths.
