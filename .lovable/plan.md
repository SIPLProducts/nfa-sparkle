Rename "Update in SAP" to "Save" on Edit screens

## Goal
Replace the remaining "Update in SAP" action button label with "Save" everywhere it appears in edit screens, matching the user's recent request to remove standalone Save buttons and consolidate on the primary SAP action.

## Current state
A codebase search found only one occurrence of the exact text "Update in SAP":
- `src/components/report/RecordEditDialog.tsx` line 312 — inside the Edit ENFA dialog footer.

The other active edit screen (`src/routes/_authed.nfa.$id.change.tsx`) uses "Submit for Approval" and is out of scope for this rename.

## Work
1. Open `src/components/report/RecordEditDialog.tsx`.
2. Change the footer button text from `"Update in SAP"` to `"Save"`.
3. Optionally swap the `Send` icon for a `Save` icon to match the new label while preserving the existing loading spinner behavior.
4. Run a typecheck/build to confirm no breakage.

## Out of scope
- No functional changes to the `sendToSap` handler or dialog behavior.
- No changes to "Submit for Approval" or other action buttons.
