# Editable DOCX for Initiator, PDF for Approvers

## Confirmed scope

- Level 1 / Initiator receives an actual `.docx` Print Form, not only a PDF.
- Only **Detailed Description** is editable. Header fields, Approvals, Comments, and mapped record data remain controlled by the application.
- The Initiator can download/open the DOCX, edit it in Word, upload the revised DOCX, and save it against the eNFA record in the Web DB.
- Level 2 and Level 3 Approvers continue to view/download the Print Form as PDF and retain the existing Approve, Reject, Back to Initiator, and Clarification actions.
- Clarification returns the record to the Initiator; the latest DOCX can be revised and the existing approval flow restarts.
- No unrelated SAP payload, approval action, report, attachment, or screen behavior will be changed.

## Implementation

### 1. DOCX document model and secure storage

- Add a document-version table keyed by eNFA number, with version, storage path, filename, MIME type, current/final state, creator, and timestamps.
- Store DOCX binaries in a private `enfa-working-documents` bucket rather than inside database rows.
- Add grants and row-level rules so only the record’s Initiator can create/replace the working DOCX, while assigned Approvers can read the current version.
- Keep `sap_record_draft.detailed_description` as the rich-description source used by the web Print Form and PDF.

### 2. Generate the Initiator DOCX

- Generate the DOCX on the server from the same mapped values used by the current Print Form: company, eNFA number, plant, date, Initiator, NFA type, function, subject, scope, timeline, budget, Detailed Description, Approvals, and Comments.
- Reproduce the current reference structure: Ramky logo at upper-right, centered company/header, grey “NOTE FOR APPROVAL” band, compact field rows, rich Detailed Description, three-column Approvals grid, and Comments immediately below.
- Convert supported rich HTML into native Word paragraphs, bold/underline text, alignment, lists, tables, and images instead of flattening it to plain text.
- Mark the Detailed Description region as the editable area and protect the remaining mapped document content as far as Microsoft Word’s document-protection format supports.
- Generate/store the first DOCX after an eNFA number is created, and regenerate a version when the Initiator saves an updated description or receives clarification.

### 3. Initiator document actions

- Replace the current Print Form editing-only flow for Initiators with clear actions to **Download DOCX** and **Upload Revised DOCX** while retaining the existing in-app description editor.
- Validate uploaded files as DOCX, preserve the uploaded working document, extract the Detailed Description region, and update the saved rich description used by the web form and Approver PDF.
- Reject files whose protected template structure or eNFA identity no longer matches, preventing a document from being attached to the wrong record.
- Show the saved document version and last-updated time without changing other Create/Edit actions.

### 4. Approver PDF and workflow behavior

- Keep Approver Print Form read-only and PDF-only.
- Build the PDF from the latest saved description and current approval/comment data using the existing app layout, so uploaded DOCX edits appear in the next Approver PDF.
- Preserve all current Approve, Reject, Back to Initiator, and Clarification API calls.
- On clarification, retain prior document versions/comments and make a new Initiator working version available.
- Include Initiator/Approver identity in workflow/comment metadata while keeping Subject as its own mapped field; do not place workflow text inside Detailed Description.

### 5. Verification

- Test DOCX generation, Word opening, description-only editing, revised DOCX upload, version replacement, and wrong-file rejection.
- Test rich text, pasted Word/Excel tables, alignment, images, long descriptions, Approvals, and multi-version Comments.
- Verify the latest Initiator revision appears in the Approver PDF and that existing approval actions still work.
- Validate access rules: Initiator write access, Approver read-only access, and completed records non-editable.

## Required references and external dependency

- The uploaded items currently available are screenshots, not the actual DOCX template or Excel workbook. The exact Word styles, table dimensions, editable region, and Excel field mapping can only be matched after those two binary files are uploaded. Until then, implementation can match the visible reference and existing Print Form, but cannot claim exact template fidelity.
- No SAP DMS API is currently present in the project. Final PDF upload to SAP DMS and deletion of the Web DB working document will be added only when the DMS endpoint, authentication, request format, success response, and document identifiers are supplied. The app must never delete its working document before SAP confirms a successful save.
- Until that API exists, final approval/rejection will keep the current workflow and retain the Web DB document safely; it will not simulate a DMS save or prematurely delete data.

## Technical notes

- Use a Worker-compatible pure-JavaScript DOCX generator in an authenticated server function; no LibreOffice, filesystem process, or native conversion dependency.
- Parse revised DOCX files in a controlled server function and accept only the designated Detailed Description content.
- Use private object storage with signed/authenticated downloads, explicit table grants, and record-scoped policies.
- The existing client-rendered PDF remains the Approver output until a real DMS contract is available.