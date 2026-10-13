# Remove "from SAP" from the Preview loading message

## What changes

In the Preview dialog, the loading line currently reads:

`Fetching the document from SAP…`

It becomes:

`Fetching the document…`

The spinner, the rounded bordered container, the dialog title (`Preview · <eNFA>`), the Print / Download / Close buttons, and every other screen stay exactly as they are. Only the three words ` from SAP` are dropped from that one sentence.

## Where

One line in the Preview dialog component: the loading message rendered while the document is being fetched. The fetch itself, its priority logic (SAP document first, then the web form, then the existing behaviour), and all error handling are untouched.

## Verification

- Search the app to confirm the wording appears in no other file, test, or generated document — already confirmed: this is the only occurrence and nothing asserts on it.
- After the edit, check the build output for errors and open the Preview dialog in the browser to see the new loading text render in the same place, with the same layout.
- On the company server, this ships with a complete `dist` deploy and a restart of the web app process only.

## Technical details

- File: `src/components/report/RecordPreviewDialog.tsx`, line 156.
- Edit: replace the JSX text `Fetching the document from SAP…` with `Fetching the document…`. The `<Loader2>` spinner element and the wrapper's classes (`flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground`) are kept byte-identical.
- Scope is deliberately narrow, per your choice: the attachments dialog text (`Fetching documents from SAP…`, the `· from SAP` tag), the Create NFA dropdown messages, and the admin settings hints are left unchanged.
- No migration, no backend change, no SAP configuration change.
