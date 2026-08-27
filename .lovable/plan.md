# Edit dialog buttons + Create NFA field layout

## 1. Edit screen buttons
File: `src/components/report/RecordEditDialog.tsx` (the Edit dialog used by E-NFA Report and My NFAs)

- Remove the secondary **Save** button from the dialog footer (local save action no longer exposed).
- Rename the **Update in SAP** button to **Save**, keeping its existing `sendToSap` handler, styling, disabled state and spinner.
- Footer becomes: `Cancel` + `Save` (SAP update action).

## 2. Create NFA — remove Project field
File: `src/routes/_authed.nfa.new.tsx`

- Remove the `Project` select block from the Organisation & Type section.
- Remove the now-unused `project` state, the `setProject` call in Load Sample, and the `projectsFor` import.
- Keep the payload key `project: null` unchanged so the create API contract stays identical.

## 3. Create NFA — Function beside Plant
Same file.

- Move the `Function` field into the same grid row as `Plant` by dropping its `md:col-span-2` class, so Plant and Function sit side by side in the two-column grid (which the removed Project field frees up).
- No change to loaders, placeholders, retry links, or validation.

## Out of scope
No changes to APIs, validation rules, other fields, or any other screen.
