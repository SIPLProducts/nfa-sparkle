# Direct Microsoft Word Editing for Initiator Print Forms

## Confirmed outcome

- For an Initiator, **Print Form** will no longer open the current preview dialog or a separate description editor.
- It will open the record’s actual `.docx` in Microsoft Word for the web, with the entire document editable.
- Word will preserve the supplied reference structure: page setup, 12 tables, fonts, spacing, alignment, embedded Ramky logo, Detailed Description, Approvals, and Comments.
- Saving in Word will create a new version of the `.docx` in the application’s private document storage automatically; no download/upload step remains.
- Approvers remain read-only and receive a PDF generated from the latest saved DOCX.
- Existing SAP submission, approval actions, remarks, attachments, and unrelated screens remain unchanged.

## Important Microsoft prerequisite

Direct Word-for-web editing of a DOCX stored by this application cannot be provided by an ordinary iframe or the current DOCX library. Microsoft requires a supported Microsoft 365 document-hosting integration for browser editing, such as WOPI/Cloud Storage Partner Program or an approved SharePoint Embedded setup. Microsoft documents WOPI as the protocol that lets Word for the web read and save files held by another service.

The workspace currently has **no Microsoft Word app-user client configured**. Before the feature can operate, an organization administrator must provide/configure:

- A Microsoft 365 tenant and licensed Word-for-web users.
- The approved Word/SharePoint document-editing integration.
- Its tenant/application registration and allowed application URLs.
- For direct saves into this application’s storage, the WOPI discovery/action configuration and CSPP approval.

No Microsoft credentials will be hardcoded. If this prerequisite is unavailable, exact Microsoft Word editing inside the application is not implementable; the existing built-in rich editor remains the only self-contained alternative.

## Implementation

### 1. Make the supplied DOCX the canonical template

- Use the supplied `ENFA-100122-working-2.docx` package as the template instead of rebuilding an approximate document with web tables.
- Replace only mapped field values and editable record content while retaining the template’s Word styles, relationships, table geometry, image parts, margins, and page structure.
- Add stable Word content controls/bookmarks for every mapped region so later saves can be validated and converted reliably.
- Keep versioned private copies; never overwrite or delete the previous version.

### 2. Add a secure Word editing host

- Add authenticated document endpoints for metadata, current DOCX bytes, locks, save-back, and version checks required by Microsoft Word for the web.
- Issue short-lived, record-scoped edit tokens only to the record Initiator; validate identity and ownership again on every read/write.
- Enforce file-size, DOCX package, eNFA identity, and concurrency checks before accepting a Word save.
- Save each accepted Word update as a new private working-document version and mark the prior working version as superseded.
- Record open/save/version events in the existing audit history without changing approval APIs.

### 3. Replace the Initiator Print Form experience

- Route an Initiator’s **Print Form** action directly to a full-size Word editing workspace—no existing preview dialog, Edit Description button, Download DOCX, or Upload Revised DOCX controls.
- Show connection/loading/save-conflict/error states around the Word editor, plus a clear return action.
- Let Word autosave through the secure document host; show the current saved version and last-saved time.
- Permit the whole document to be edited, as requested, while validating that the file remains a readable DOCX associated with the same eNFA record.

### 4. Keep mapped data and workflow consistent

- Populate the first DOCX after the eNFA number is assigned, using the existing Create form, approver, comment, and logo sources.
- Treat the latest saved DOCX as the document source of truth for Initiator-authored changes.
- Do not send Detailed Description or other newly edited Word content through new SAP APIs.
- Preserve existing clarification behavior; reopening after clarification returns to the latest DOCX and a new save creates the next version.
- Completed/non-editable records must open only in read-only form.

### 5. Generate the Approver PDF from the same DOCX

- Convert the latest saved DOCX through Microsoft’s document conversion service so tables, images, fonts, pagination, comments, and spacing match the Word document.
- Store/cache the resulting PDF against the exact source DOCX version.
- Open only this PDF for Level 2/Level 3 Approvers; no editable Word surface is exposed to them.
- Refresh the PDF whenever a newer Initiator DOCX version is saved.

### 6. Access rules and data model

- Extend working-document metadata with the Microsoft editing/file identity, source version, PDF version/path, editing state, and last synchronized time.
- Grant document read/write only through authenticated, record-scoped server operations; browser code never receives service credentials.
- Give the Initiator edit access, assigned Approvers read-only PDF access, and administrators controlled support access.
- Keep private storage and explicit database grants/row-level rules for every new table or column path.

### 7. Verification

- Confirm the supplied reference opens in Word for the web with identical tables, logo, fonts, spacing, alignment, and page structure.
- Edit text, formatting, tables, images, headers, Approvals, and Comments; save without downloading; reopen and confirm persistence.
- Test concurrent edit locks, expired sessions, interrupted saves, wrong-record files, invalid DOCX packages, and version history.
- Confirm the Approver PDF is generated from the latest DOCX and matches its pagination and content.
- Regression-test Create, Edit, Approve, Reject, Back, Clarification, attachments, reports, and existing SAP calls.

## Technical notes

- The current `docx` generator is suitable for initial document construction but is not a Microsoft Word editor.
- The current HTML-to-canvas PDF path will be replaced only for this DOCX-backed Approver output; existing unrelated previews remain unchanged.
- The Microsoft Word app-user connector alone provides file API access but does not by itself authorize an embedded editable Word surface. The Microsoft document-hosting prerequisite above must be completed before end-to-end implementation can be verified.
