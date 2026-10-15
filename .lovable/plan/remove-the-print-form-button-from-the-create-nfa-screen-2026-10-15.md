# Remove the Print Form button from the Create NFA screen

## What changes

On **Create NFA**, the header action bar currently shows three buttons: **Load Sample**, **Print Form**, **Submit**. The **Print Form** button and the draft print-form dialog it opens will be removed, leaving **Load Sample** and **Submit**.

The two remaining buttons stay centred/split evenly across the row on small screens (the row currently reserves space for three buttons), so the header does not look lopsided.

Nothing else on the screen changes:

- Company / Plant / NFA Type / Function selectors, Note Details, the rich-text **Detailed Description** editor and its expand view, Document Attachments, and the **Approvers** card all behave exactly as before.
- Submit, draft saving, and every SAP request payload are untouched.
- Print Form stays available where it is used today: **My NFAs → Edit** and **Approvals**.

## Technical details

All edits are in `src/routes/_authed.nfa.new.tsx` (frontend only, no database or SAP changes):

1. Delete the `Print Form` `<Button>` from the `PageHeader` `actions` row (the one calling `setPrintOpen(true)` with the printer icon), and change the wrapper's mobile layout from a three-column grid to a two-column grid.
2. Delete the now unreachable `<PrintFormDialog … />` block at the bottom of the page, along with the `printOpen` state and the `Printer` and `PrintFormDialog` imports that only served it.
3. Keep `initiatorName` (it is still used when building the submit payload) and keep the `approvers` state (still used by the Approvers card and submit logic).
4. Leave `src/components/document/PrintFormDialog.tsx` itself untouched, since My NFAs and Approvals still render it.

## Verification

- Type-check and build pass with no unused-import or layout errors.
- Browser check with mocked SAP responses: Create NFA header shows only Load Sample and Submit; no Print Form button anywhere on the page; the Detailed Description editor, Document Attachments and Approvers card still render and update; Submit still runs the normal flow.
- Confirm Print Form still opens from My NFAs → Edit and from Approvals.
