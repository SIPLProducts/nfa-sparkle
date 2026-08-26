# Remove the Save button from every Edit screen

## What changes

### 1. Edit ENFA dialog (Reports and My NFAs screens)
`src/components/report/RecordEditDialog.tsx` — the dialog in the screenshot.

- Remove the **Save** button from the footer. The footer keeps only **Cancel** and **Update in SAP**.
- Remove the now-unused `save()` handler, the `saving` state, and the `Save` icon import.
- The dialog still loads the live SAP record exactly as today; the existing fallback that reads a previously saved local draft stays in place so old drafts still display.
- Nothing else changes: Update in SAP, field layout, Detailed Description popup, and SAP payload all stay the same.

### 2. NFA Change Request screen
`src/routes/_authed.nfa.$id.change.tsx`.

- Remove the **Save Changes** button from the header. The header keeps **Back to NFA** and **Submit for Approval**.
- The submit flow (`save(true)`) is untouched; the local-only save path is no longer reachable from the UI.

## What stays as-is
- The **Save** button on the **Create NFA** screen is kept — that is a create screen, and the Save button there was explicitly requested earlier (renamed from "Save Draft").
- No database, API, or navigation changes.

## Technical notes
- Only two files edited: `src/components/report/RecordEditDialog.tsx` and `src/routes/_authed.nfa.$id.change.tsx`.
- After removal, verify no unused imports/variables remain so the build stays clean.
