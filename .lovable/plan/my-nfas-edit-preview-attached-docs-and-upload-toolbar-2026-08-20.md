# My NFAs: Edit, Preview, Attached Docs and Upload toolbar

Bring the same SAP-style action bar the eNFA Report screen has onto the **My NFAs** screen, matching the reference SAP list and edit screens. Existing design, filters, columns and navigation stay exactly as they are.

## What changes for the user

- Each row (desktop table and mobile card) gets a radio selector so exactly one NFA can be selected.
- A row of four buttons appears above the list, beside the record count: **Upload File, If Any**, **Attached Docs**, **Preview**, **Edit** — the same wording, order and styling as the Reports screen.
- The buttons act on the selected NFA's eNFA number and use the live SAP APIs already registered in Admin -> SAP API Settings:
  - Upload sends the picked files to SAP (Upload Document) and shows SAP's own reply.
  - Attached Docs lists the SAP documents for that number, with view and download.
  - Preview renders the SAP print document.
  - Edit opens the SAP record form (Subject, Scope Impact, Budget Impact, Timeline Impact, Detailed Description, Submit for Approval).
- If a selected NFA has no SAP eNFA number yet (still local only), the action shows a clear message instead of calling SAP.
- Clicking a row's ENFA link or **Open** still navigates to the detail page as today.

## Technical notes

- `src/routes/_authed.nfa.my.tsx`: add `selected` state, a radio column in the table and card summary, the count + button bar above the list, and the three dialogs. Reuse `RecordAttachmentsDialog`, `RecordEditDialog`, `RecordPreviewDialog` and the exported `uploadToSap` helper from `src/components/report/` — no new components, no duplicated logic.
- The dialogs take a `SapReportRow`; build that object from the selected local `NfaRow` (`REFFLD` = `enfa_number`, plus subject/plant/type fields that already map). `RecordEditDialog` re-fetches the authoritative record from SAP via `/api/public/enfa-detail`, and Preview/Attachments/Upload key off `REFFLD`, so nothing is hardcoded.
- No schema change and no new endpoints.
