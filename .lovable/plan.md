# Lighter Print Form watermark in SAP DMS PDFs

## Cause
The Web Print Form draws the watermark (APPROVED / DRAFT / REJECTED) in mid-grey at about 19% opacity, so the text underneath stays readable. The PDF stored in SAP DMS draws the same word in solid, fully opaque grey **on top of** the page, which is why it looks dark and hides the table text (see the REJECTED sample).

## Fix
- In the PDF generator, draw the watermark with the same grey and the same 19% transparency the web form uses. Size, angle and position stay as they are.
- Restore full opacity right after the watermark so page frame, footer and text are unaffected.
- The status word logic (Approved after completion, Rejected when rejected, Draft otherwise) is untouched.
- Downloaded PDFs share this generator, so they get the same lighter watermark. Nothing else changes.

## Technical details
- `src/lib/print-form-pdf.ts` (watermark block around line 166): `pdf.setGState(new pdf.GState({ opacity: 0.19 }))`, `setTextColor(119,119,119)` (sRGB of `oklch(0.55 0 0)`), draw text, then `setGState(new pdf.GState({ opacity: 1 }))`.
- Put the colour and opacity in one shared constant next to the existing PDF_PAGE settings, plus a small test asserting opacity 0.19 and grey 119.
- Verify by generating a sample PDF and comparing it visually against the web preview.
