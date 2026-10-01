# Remove Formatted Document from all previews

## Change
- Remove the “SAP document / Formatted document” selector and the entire Formatted Document view from the shared Preview dialog.
- Keep Preview opening directly to the existing SAP document, including its loading, fallback summary, open, download, print, and close behavior.
- This removes the section everywhere the shared Preview is used: My NFAs, Approvals, and E-NFA Report.
- Keep every Print Form button, dialog, generated document, PDF behavior, and workflow unchanged.

## Technical cleanup
- Remove only state, data loading, imports, and rendering used exclusively by the deleted Formatted Document view.
- Retain saved Detailed Description loading because the SAP preview fallback currently uses it.

## Verification
- Confirm Preview on My NFAs, Approvals, and Report no longer shows “Formatted document.”
- Confirm SAP preview actions still work.
- Confirm Approvals Print Form remains available and unchanged.
