# In-app Print Form editing

## Goal
Replace the Initiator’s download/edit/upload process with a built-in document editor. The Print Form opens inside the application, only Detailed Description is editable, and saving updates both the Web DB and the stored working DOCX version. Approvers continue to receive the read-only PDF view.

## User experience
- Open **Print Form** to display the existing Word-style document layout directly in the application.
- Keep company/header fields, logo, Approvals, Comments, and document structure read-only.
- Allow the Initiator to edit only **Detailed Description** using the existing rich editor, including text, bold/italic/underline, lists, tables, pasted Word/Excel/web content, images, spacing, and alignment.
- Replace **Download DOCX** and **Upload Revised DOCX** with clear **Edit Description**, **Save Document**, and **Cancel** actions.
- Show the current saved document version and saving status without requiring any external file handling.
- Keep Approver access read-only and retain app-generated PDF output.

## Save and version flow
1. Load the latest Detailed Description and working-document version when the Print Form opens.
2. On **Save Document**, validate and save the edited rich content to the existing Web DB draft record.
3. Regenerate the DOCX from the unchanged mapped fields plus the updated Detailed Description.
4. Embed the logo and all description images as permanent document bytes.
5. Save the regenerated DOCX as the next private working-document version and mark the prior version superseded.
6. Update the open Print Form immediately and notify its parent screen so the latest content remains available for the next workflow step.
7. If DOCX regeneration fails, show a clear error and do not report the document as fully saved.

## Workflow safeguards
- Editing remains available only where the existing caller grants Initiator edit permission.
- Approvers cannot edit the document and continue to view/export the current app-layout PDF.
- Subject, header mappings, Approvals, Comments, SAP payloads, approval actions, and Print Form layout remain unchanged.
- Keep existing DOCX storage/version history and generation functions; remove only the Initiator’s manual download/upload controls and flow.
- Do not add Microsoft 365, ONLYOFFICE, DMS, new APIs, or database schema changes.

## Technical details
- Reuse the current `EnfaDocument` and rich-text editor as the in-app Word-style surface.
- Consolidate document generation and version saving so manual saves and initial creation use the same mapping and embedded-image behavior.
- Keep generated DOCX as the workflow artifact while rich HTML remains the editable source used by the Print Form and PDF.
- Verify rich text, tables, pasted content, embedded images, version increments, reopen-after-save behavior, and read-only Approver PDF behavior.
