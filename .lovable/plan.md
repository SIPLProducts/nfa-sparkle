# Editable Print Form document workflow

## Result

- The Initiator’s Print Form becomes the working document for the eNFA, stored privately as a versioned `.docx` file.
- Opening **Edit** for an Initiator opens the Print Form directly in its built-in document editor instead of requiring download and upload.
- The fixed Print Form structure remains locked: logo, header fields, Approvals, Comments, tables, spacing, fonts, and positioning.
- Detailed Description remains the editable area, preserving rich text, tables, pasted Word/Excel/web content, images, alignment, and formatting.
- Saving updates the rich content and immediately regenerates and stores a new `.docx` version. No manual download/upload round trip is required.
- Approvers continue to see the same document read-only as PDF. The final PDF is stored privately with the eNFA for later SAP DMS transfer.

## Workflow

```text
Level 1  Initiator  Save   -> store working DOCX
Level 2  Initiator  Edit   -> update working DOCX in the built-in editor
Approval Approver   View   -> render the latest saved document as PDF
Final    Workflow   Store  -> save final PDF privately for future DMS sending
```

- Clarification/sent-back records reopen the latest working document for the Initiator and create a new DOCX version when saved.
- In-process and completed records remain read-only.
- Existing approval, rejection, clarification, SAP payloads, and Print Form layout remain unchanged.

## Implementation

1. **Use the stored working document as the Edit entry point**
   - Change the Initiator Edit action to open the Print Form editor directly after loading the latest saved DOCX metadata and locally preserved rich content.
   - Keep the existing non-document record fields and SAP update behavior available without changing their APIs.
   - Remove the need for the Initiator to use Download DOCX / Upload Revised DOCX for normal editing; downloading can remain an optional export.

2. **Save DOCX directly from the editor**
   - On Save, persist Detailed Description to the existing local draft record.
   - Regenerate the complete DOCX from the unchanged Print Form template and store it as the next version in private file storage.
   - Embed the logo and all Detailed Description images as document bytes, never temporary URLs.
   - Make the draft update and document-version creation report partial failures clearly without corrupting the previous working version.

3. **Keep one document source across the workflow**
   - Load the latest saved rich content and current header/approval/comment data whenever the document opens.
   - Ensure Approver PDF output uses that latest saved content and the same Print Form layout.
   - Preserve historical DOCX versions as superseded records while exposing only the latest working version for editing.

4. **Store the final PDF**
   - Extend the existing document metadata safely to distinguish working DOCX and final PDF artifacts.
   - Store the generated final PDF privately, linked by eNFA number, with filename, MIME type, size, version/state, creator, and timestamps.
   - Add authenticated access rules so the Initiator, assigned Approvers, and administrators can read the relevant document while only permitted workflow actions can create or replace the final artifact.
   - Do not add SAP DMS calls; the saved final PDF becomes the future DMS-ready artifact.

5. **Approval and completion behavior**
   - Approvers receive the read-only PDF view and no document editing controls.
   - On the configured terminal approval/rejection outcome, generate and store the final PDF once the action succeeds.
   - Keep completed documents non-editable and retain their stored DOCX/PDF records instead of deleting them before a future confirmed DMS transfer.

6. **Verification**
   - Verify initial save, direct Edit reopening, rich-text/table/image persistence, version increments, clarification editing, and completed read-only behavior.
   - Verify the DOCX opens in Microsoft Word with embedded images and stable formatting.
   - Verify the Approver PDF matches the current Print Form and the stored final PDF can be reopened by authorized users.
   - Run focused type and workflow tests without changing unrelated screens or APIs.
