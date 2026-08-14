# Report screen: record actions (Upload, Attached Docs, Preview, Edit)

Adds an SAP-style action bar beside the results count, with single-record selection, matching the SAP reference screens. All data stays live from the SAP report call — nothing hardcoded. The current filter layout, table design and styling stay exactly as they are.

## What changes for the user

**Action bar (beside "N results")**
- A row selector: each result row gets a radio button (desktop table and mobile cards) so exactly one record can be selected.
- Four buttons next to the results count: **Upload File, If Any**, **Attached Docs**, **Preview**, **Edit**. They stay disabled until a record is selected, matching the SAP toolbar behaviour.

**Edit** (SAP reference image 2)
- Opens the selected record in a form laid out like the SAP screen: Company, Project/Plant, NFA Type read-only in a header strip; then Subject, Scope Impact, Budget Impact (Lakhs), Timeline Impact (Days), a **Detailed Description** button, and a **Submit for Approval** action.
- Values are pre-filled from the selected SAP row.

**Detailed Description** (SAP reference image 3)
- Opens a full-size editor dialog titled with the ENFA number, exactly like the SAP popup, using the existing rich text editor already used on the NFA screens.

**Upload File, If Any / Attached Docs**
- Upload opens a file picker and stores the file against the selected ENFA number.
- Attached Docs lists every file for that ENFA number with view/download and inline PDF/image preview, reusing the existing attachment viewer style.

**Preview**
- Opens a printable, read-only NFA summary of the selected record: header details, subject, scope, budget/timeline, description, and the full approver ladder (Designation/Approver/Status for each level) with a Print button.

## Saving back to SAP

Edits are written back to SAP through the middleware, the same path the report already uses. This needs one more registered endpoint. To wire it, share:

- the SAP update URL (e.g. `http://10.200.1.2:8000/e-nfa/enfa_update//create?sap-client=300`),
- the exact request payload JSON (including any keys with trailing spaces),
- a sample success response.

Until that is supplied, **Save / Submit for Approval** will show a clear message that the SAP update endpoint is not registered yet, instead of silently failing. Everything else (selection, preview, description viewing, attachments) works immediately.

## Technical notes

- `src/routes/_authed.report.tsx`: add `selected` row state, radio column, action bar beside the count, and four dialogs. Existing filter/table markup untouched.
- New components under `src/components/report/`: `RecordEditDialog`, `RecordPreviewDialog`, `RecordAttachmentsDialog` — kept small and driven by the `SapReportRow` already returned by `/api/public/enfa-report`.
- Attachments: new table `public.sap_attachment` (enfa_number, storage_path, filename, mime, size, uploaded_by, uploaded_at) with GRANTs and RLS (authenticated users read; uploader/admin insert & delete), plus reuse of the existing `nfa-attachments` storage bucket under an `sap/<enfa_number>/` prefix.
- SAP write: new `updateEnfaRecord` server helper in `src/lib/sap-report.server.ts` plus a public route `src/routes/api/public/enfa-update.ts` mirroring the report route (bearer check, middleware call, payload visible in the Network tab). The payload shape is read from the registered `sap_endpoint` row so nothing is hardcoded.
- Detailed Description reuses `RichTextEditor` / `RichTextView`.
