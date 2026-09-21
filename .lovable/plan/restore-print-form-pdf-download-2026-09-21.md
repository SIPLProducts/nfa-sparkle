# Restore Print Form PDF Download

## Confirmed cause

- The Print Form still renders its complete application-built document with the dynamic logo, header, Detailed Description, approval details, and version-wise comments.
- Its **Download PDF** action no longer exports that rendered document. It calls the same configured service used by Preview, so the downloaded file is the Preview/SAP PDF instead.
- The uploaded `ENFA-100122_4.pdf` confirms this path: its metadata identifies the SAP-generated form rather than an application-rendered Print Form.
- The existing Print Form-specific PDF layout and containment rules remain available, as do the PDF libraries required for browser export.

## Changes

1. **Restore Print Form’s own PDF exporter**
   - Generate the PDF from the rendered Print Form referenced inside the dialog.
   - Include exactly the data currently shown in that form: dynamic company logo, header values, rich Detailed Description, tables/images, approval details, Initiator, and version-wise comments.
   - Keep safe A4 page splitting, content-width containment, image sizing, page borders, page numbering, and the existing status-based draft treatment.

2. **Separate Print Form from Preview downloads**
   - Remove the Preview-PDF request from the Print Form download action and its callers.
   - Keep the existing Preview screen and its SAP/configured PDF download unchanged.
   - Keep DOCX generation, editing, printing, approval actions, APIs, saved-data resolution, and all other screens unchanged.

3. **Handle export state and failures cleanly**
   - Wait for dynamic logo and approval data before export, as the dialog already does.
   - Always remove temporary export styling after success or failure.
   - Report Print Form generation failures accurately without showing Preview-specific messages.

## Verification

- Open an Approvals Print Form with dynamic header, rich description, approval rows, and version-wise comments; click the real **Download PDF** button.
- Confirm the downloaded file is generated from the visible Print Form, not returned by the Preview endpoint.
- Render every PDF page for visual checks: A4 sizing, logo, tables, images, spacing, approval rows, comments, page breaks, footer numbering, and no clipped or duplicated content.
- Confirm the Preview PDF path still returns its existing configured PDF unchanged.
- Run focused Print Form/comment tests and the project type check.

## Technical scope

Update only the Print Form PDF export path and remove its now-unneeded Preview variant wiring. Reuse the existing `html2canvas-pro`, `jsPDF`, Print Form DOM reference, and `.enfa-pdf-export` rules; do not alter dynamic data sources or shared document content.
