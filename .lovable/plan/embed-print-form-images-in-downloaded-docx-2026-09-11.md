# Embed Print Form Images in Downloaded DOCX

## Confirmed issue

- The uploaded `ENFA-100122-working.docx` contains one embedded image relationship and one actual image file, corresponding to the Ramky logo.
- The current DOCX generator handles text, formatting, lists, and tables from Detailed Description, but it does not process `<img>` elements. Those images are therefore omitted rather than embedded.
- The existing logo is already passed as image data; no temporary browser path is stored in the Word file.

## Implementation

### 1. Resolve images before DOCX generation

- Collect images used in the Detailed Description when the Initiator generates a DOCX.
- Convert supported image sources—including Base64/data URLs, application-hosted images, and browser blobs available at generation time—into actual byte data before sending the document request.
- Validate image type and size, and reject an image with a clear message if its data cannot be safely resolved instead of creating a broken Word reference.

### 2. Embed images in the Word package

- Extend the DOCX input model to carry each resolved image’s bytes, format, dimensions, and source identifier.
- Update rich-content conversion so `<img>` elements become native Word image objects with embedded media relationships.
- Preserve the displayed image order, aspect ratio, practical print width, and paragraph alignment from the Print Form.
- Continue embedding the Ramky logo directly and retain its existing size and placement.

### 3. Preserve revised DOCX behavior

- Keep text, tables, lists, formatting, Approvals, Comments, storage versioning, and PDF behavior unchanged.
- Ensure images extracted from an Initiator-uploaded revised DOCX remain represented as embedded data when the Detailed Description is synchronized and a later DOCX version is generated.
- Do not introduce external image links or temporary `blob:` paths into generated files.

### 4. Verification

- Generate a DOCX containing the logo plus Base64, pasted Word/Excel, uploaded, and application-hosted images.
- Inspect the DOCX package to confirm every displayed image has a corresponding media file and relationship.
- Validate the DOCX structure, reopen it in a Word-compatible renderer, and confirm images remain visible after download/reopen with correct size and alignment.
- Confirm existing text, tables, Approvals, Comments, DOCX upload/versioning, and Approver PDF output remain unchanged.

## Scope

- This change is limited to reliable image embedding in Initiator DOCX files.
- It does not add SAP DMS integration or change approval workflow, SAP payloads, PDF access, or unrelated screens.
