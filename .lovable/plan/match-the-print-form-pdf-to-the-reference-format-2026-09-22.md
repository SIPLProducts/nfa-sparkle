# Match the Print Form PDF to the reference format

## Confirmed comparison

- The reference PDF is a two-page A4 document with a consistent 15 mm-style outer frame, centered company heading, compact right-aligned logo, grey title band, aligned header rows, bordered three-column approval grid, version-wise comments, diagonal DRAFT watermark, and page footer.
- The current Print Form PDF is a one-page browser-generated image. Its heading and logo are not positioned like the reference, the NFA number and date run together, approval cells lose their borders and column structure, comments are absent from the rendered page, and all content is compressed into one tall capture.
- The current saved Detailed Description includes rich text, a table, and embedded screenshots. Those are real saved application data and must remain, but the PDF needs to contain and paginate them without allowing them to distort the document structure.
- The current exporter captures one continuous document canvas and then slices that bitmap. This cannot reproduce the reference’s independently framed A4 pages reliably.

## Implementation

1. **Build dedicated A4 pages for PDF export**
   - Replace continuous-canvas slicing with a temporary PDF-only paginated document built from the existing Print Form data.
   - Give every page the reference margins, outer frame, content width, DRAFT watermark, and `ENFA No. … – page of total` footer.
   - Render each completed A4 page independently so later pages retain the same frame and alignment.

2. **Match the reference header and field geometry**
   - Center the dynamic company name across the sheet while anchoring the dynamic company logo at the top-right with preserved proportions.
   - Match the compact grey `NOTE FOR APPROVAL` band, font sizing, row spacing, label weight, NFA/date alignment, and header margins from the reference.
   - Continue using the selected record’s actual company, logo, NFA, initiator, type, function, subject, scope, timeline, and budget values.

3. **Lay out description, approvals, and comments safely**
   - Preserve the complete saved Detailed Description, including formatted text, tables, and images.
   - Constrain tables and images to the printable width and preserve image aspect ratios; embedded screenshots remain present but cannot expand into a second full-size form or push columns out of alignment.
   - Keep approval details in a bordered three-column grid with empty trailing cells, matching the reference order and spacing.
   - Continue comments version-wise across pages in their existing saved order, keeping each heading and its related names/remarks together where space permits.

4. **Keep all other behavior unchanged**
   - Limit changes to the Print Form PDF presentation and pagination path.
   - Do not change saved data, API calls, SAP settings, approval workflow, permissions, on-screen editing, DOCX, browser Print, Preview PDF, uploads, or unrelated screens.

## Verification

- Download the Print Form PDF through the real button for the same record used in the current PDF.
- Render every generated page and compare it with the supplied reference for logo placement, header alignment, fields, approval grid, comments, tables, margins, fonts, spacing, watermark, footer, and page breaks.
- Confirm all current record data remains present and ordered, with no clipping, overlap, stretched images, lost borders, merged header values, sidebar/dialog capture, or blank continuation pages.
- Confirm long content produces as many properly framed A4 pages as needed.
- Run the focused Print Form, comment-history, approval-document, and logo tests plus the project type check.

## Technical scope

- Primary change: the PDF export and pagination logic in `PrintFormDialog`.
- Supporting changes: narrowly scoped PDF-only document structure/hooks in `EnfaDocument` and PDF-only rules in the global stylesheet where required.
- No backend, database, workflow, API contract, or stored-content changes.