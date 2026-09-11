# eNFA Print Form (Detailed Description kept out of SAP)

## What changes for the user

**1. Create no longer sends the description to SAP**

When an eNFA is submitted, the description field in the SAP create request is sent empty. Every other value (company, plant, type, function, subject, scope, budget, timeline, attachments, user id) is sent exactly as today. The description the initiator typed is still saved with the record in the application.

**2. The description is kept for the Print Form**

The rich description (bold text, tables, images, content pasted from Word, Excel or a web page) is stored with the record when it is created and whenever it is edited, so the Print Form can always show it. Editing an existing record also keeps the rich version instead of only the plain text pulled back from SAP.

**3. Print Form**

A "Print Form" view shows the reference "Note for Approval" layout:

```text
+--------------------------------------------------------------+
| Company name                                  [logo]          |
|                    NOTE FOR APPROVAL                          |
| NFA No / Plant                       Date                     |
| Initiator | NFA Type | Function | Sub | Scope Impact          |
| Timeline Impact (Days)      Budget Impact Rs. (Lakhs)         |
+--------------------------------------------------------------+
|  DETAILED DESCRIPTION  (rich text, tables, images)            |
+--------------------------------------------------------------+
| Role / User id / Name approver boxes                          |
+--------------------------------------------------------------+
```

- Header values come from the form / stored record — nothing hardcoded.
- The description appears only inside the description band, nowhere else.
- Print / Save-as-PDF from the view produces the same A4 layout, without splitting table rows across pages.

**4. Where the button appears**

- **Create screen** — a "Print Form" button next to Submit; opens the form filled with what is currently on screen (works before submission too).
- **Edit dialog** (Reports and My NFAs) — a "Print Form" button showing the record with the description currently in the editor.
- **Approvals screen** — a "Print Form" button beside Preview for the selected record.

Create, Edit, Approve, Reject, Clarification, validations, attachments and every existing API stay exactly as they are.

**5. Not in this stage**

No DMS API, no upload of the generated document. The Print Form is view/print only for now.

## Technical notes

- `src/routes/_authed.nfa.new.tsx`: send `TEXT: ""` in the `create` payload; keep `detailed_description` in the local `nfa` insert. After SAP returns `ENFA_NO`, upsert `sap_record_draft` (`enfa_number`, subject, scope, budget, timeline, `detailed_description` HTML, `updated_by`) so the Print Form has the rich content keyed by eNFA number. Add a `Print Form` button opening a new dialog.
- New `src/components/document/PrintFormDialog.tsx`: thin dialog wrapper around the existing `EnfaDocument` with Print / Close actions; accepts the header fields, description HTML and approvers as props. Reused by all three screens.
- `src/components/report/RecordEditDialog.tsx`: keep the stored rich draft as the editor value when one exists (today SAP's plain `TEXT` can overwrite it); on save, upsert `sap_record_draft` with the rich HTML; keep sending `TEXT` to the update API unchanged. Add the `Print Form` button.
- `src/routes/_authed.approvals.tsx`: add a `Print Form` button next to Preview for the selected row, feeding the row's SAP fields plus the stored draft description.
- `src/components/document/EnfaDocument.tsx` stays the single layout source; `src/styles.css` gets the `.enfa-doc` A4 `@media print` block and `break-inside: avoid` on table rows.
- No new API routes, no schema changes (`sap_record_draft` already exists with the needed columns and policies).
