# SAP-driven Preview priority

## Requested behavior

Update **Preview** in Report, My NFAs, and Approvals with this order:

| SAP data available | Preview displays |
|---|---|
| DMS document | DMS document only |
| Detailed Description, without DMS | Existing Detailed Description form |
| Both | DMS document only |
| Neither | Existing Preview behavior |

The separate **Print Form**, editing, attachments, approval actions, permissions, and saved records remain unchanged.

## Confirmed integration

- All three screens use the shared `RecordPreviewDialog`.
- Preview currently calls `/api/public/enfa-print`, using the configured **Preview Button** or **Preview In Edit** service, and renders the returned PDF.
- The supplied SAP request is `{ "PRINT": { "EFNA_NO": "100097" } }`. The supplied response is a base64 PDF beginning `JVBER…`; this is the document source to use, not a generic Attached Docs file.
- The existing Detailed Description document layout is available through `EnfaDocument`. SAP record details support the `TEXT` field; existing rich descriptions are also saved separately. Saved descriptions must not independently establish that DD is available in SAP.

## Changes

1. **Resolve the source for the selected NFA.** Use the existing configured Preview service for the DMS response and the appropriate existing SAP record-detail service for DD. Confirm the service's no-document response before implementing absence detection. If SAP also returns a generated fallback PDF from this service, verify how its response distinguishes that PDF from a DMS document; PDF content alone must not be used to invent a distinction.
2. **Apply one shared priority rule.** A valid SAP DMS PDF wins, including when DD exists. Only a confirmed no-DMS result permits the DD branch. If neither exists, retain the previous Preview path and its existing controls.
3. **Reuse the existing DD form read-only.** Render SAP DD in the established NFA document layout, retaining the selected record's details and formatting. Do not enable editing or saving from Preview, and do not alter the separate Print Form feature.
4. **Keep loading and errors safe.** Clear the previous record's content when selection changes; cancel stale requests and release PDF resources. Distinguish an SAP outage or invalid document from a confirmed missing document, with a concise error rather than a raw gateway page or misleading source choice.

## Technical details

- Add a small shared source resolver and tests; integrate it into `src/components/report/RecordPreviewDialog.tsx`.
- Reuse `src/lib/enfa-preview-pdf.ts` and the existing SAP service configuration. If needed, add explicit document-availability information to the Preview response without breaking existing callers that read `base64`, `mime`, and `filename`.
- Reuse the existing SAP detail parser and `EnfaDocument` renderer for the DD branch. Preserve screen-specific endpoint selection and authorization.
- No new database tables, migrations, hardcoded NFA numbers, SAP configuration changes, or attachment-list changes.

## Verification

- Test all four combinations, including DMS and DD together producing only DMS.
- Test blank/formatting-only DD, image/table DD, invalid PDF, SAP outage, and switching records while loading.
- Check Preview on Report, My NFAs, and Approvals; confirm separate Print Form, attachment actions, and approval/rejection PDFs remain unchanged.
- After verification, self-hosted rollout requires the complete updated web application `dist` and restarting only the web application—not the database, storage, or SAP middleware.