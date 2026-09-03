# Edit dialog tweaks

## What to change

1. Relabel Budget Impact
   - In `src/components/report/RecordEditDialog.tsx`, change the field label from **Budget Impact** to **Budget Impact (in Lakhs)**.

2. Remove Upload File from Edit
   - Remove the hidden file input, the `Upload File` footer button, and the related upload state/helpers (`fileRef`, `uploading`, `uploadFiles`, and the `Upload` / `Loader2` usage if no longer needed elsewhere in the file).
   - Keep the Save and Cancel buttons and all other Edit functionality unchanged.

## Technical notes

- Files touched: `src/components/report/RecordEditDialog.tsx` only.
- No API, payload, route, or dialog wiring changes.
- No changes to the Reports/My NFAs upload flow — those remain available through their own toolbars.
