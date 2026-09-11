# Rich Detailed Description in the eNFA document layout

Scope for this stage: the Detailed Description editing experience and the document layout only. No DMS work — the DMS service is not available yet, so nothing new is sent to SAP and no new API is created.

## What changes for the user

**1. Detailed Description keeps its formatting when pasted**

Pasting from Word, Excel, a web page, or typing directly keeps:
- normal and bold/italic/underline text, headings, colours, lists
- tables with their rows, columns, merged cells, column widths and cell alignment
- images pasted along with the content

Excel ranges paste as real tables (each cell in its own cell) instead of one line of text. Very large pasted blocks are cleaned of foreign Word/Excel styling that would break the page, while structure and emphasis stay.

**2. A document view that matches the reference form**

A new printable eNFA document view reproduces the reference layout:

```text
+--------------------------------------------------------------+
| Company name                                  [logo]          |
|                    NOTE FOR APPROVAL                          |
| NFA No: ... / Plant            Date: ...                      |
| Initiator: ...   NFA Type: ...   Function: ...                |
| Sub: ...   Scope Impact: ...                                  |
| Timeline Impact: ... (Days)   Budget Impact: Rs. ... (Lakhs)  |
+--------------------------------------------------------------+
|  DETAILED DESCRIPTION CONTENT  (rich text, tables, images)    |
+--------------------------------------------------------------+
| Role / User id / Name approver boxes                          |
+--------------------------------------------------------------+
```

- Every header value comes from the Create NFA form / stored record. Nothing is hardcoded.
- The description appears only in the content band shown in the reference image, never repeated elsewhere.
- The view is print-ready: printing or "Save as PDF" from it produces the same layout, with page breaks that don't split table rows.

**3. Where it appears**

- Create NFA and Change/Revise screens: unchanged fields and validations; only the editor gains the improved paste handling.
- The record Preview dialog gets a "Formatted document" view alongside the existing SAP-generated PDF, so the rich description is visible to the initiator and to Level 2 / Level 3 approvers.
- Clarification and re-submission keep working exactly as today; the initiator edits the same rich description and the chain restarts.

## What does not change

- No new API routes, no changes to SAP payloads: SAP keeps receiving the plain-text `TEXT` conversion exactly as now.
- Subject stays a separate field; no workflow data is stored inside the description.
- Approve / Reject / Clarification, attachments, audit trail, statuses, permissions and the SAP print/preview all stay as they are.

## Later (not in this stage)

Generating the final PDF from this layout and storing it in SAP DMS after final approval, plus locking the record from the initiator, will be added once the DMS service is available. The document view is being built so that step is a straight add-on.

## Technical notes

- `src/components/RichTextEditor.tsx`: add a `transformPastedHTML` step that strips Word/Excel `mso-*` and class noise, keeps `colspan/rowspan/colwidth/align`, and converts Excel's `<table>` clipboard flavour; keep the existing extension list, toolbar, and `htmlToPlainText` behaviour untouched. Add `TextStyle` colour/highlight attributes only if needed for pasted emphasis.
- `src/components/RichTextView.tsx`: widen the allow-list attributes for `align`, `valign`, `bgcolor`, `colwidth` while keeping DOMPurify sanitising and the current URI regexp.
- New `src/components/document/EnfaDocument.tsx`: pure presentational component taking header fields + description HTML, rendering the reference layout with tokens from `src/styles.css`; a `@media print` block sizes it to A4 and applies `break-inside: avoid` to table rows.
- `src/components/report/RecordPreviewDialog.tsx` and `src/routes/_authed.nfa.$id.tsx`: render `EnfaDocument` for the local/formatted view; the SAP PDF path is left as-is.
- `.rich-content` table/image styles in `src/styles.css` extended for the document context (borders, header shading, width clamping).
