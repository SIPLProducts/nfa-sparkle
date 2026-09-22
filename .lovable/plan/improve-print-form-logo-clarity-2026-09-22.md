# Improve Print Form logo clarity

## Goal
Make the dynamically loaded company logo clear, proportional, and professionally aligned in the Print Form and its generated outputs, without changing any document data or workflow behavior.

## Implementation
1. **Preserve the dynamic logo source**
   - Continue loading the logo from the configured SAP logo endpoint using the record’s Company Code.
   - Do not introduce a fixed logo, company mapping, or fallback branding.

2. **Prepare the logo at export quality**
   - Inspect the returned image’s intrinsic dimensions and format before display/export.
   - Convert non-PNG responses once to a high-quality, aspect-ratio-preserving PNG representation suitable for the browser, PDF capture, and DOCX.
   - Avoid stretching or enlarging a low-resolution source beyond the size its pixels can support.

3. **Refine the Print Form header logo presentation**
   - Keep the logo anchored at the right side of the header and vertically centered.
   - Use a stable professional bounding area with `object-fit: contain`, preserved aspect ratio, and enough clear space from the centered company name.
   - Apply image-rendering and print-color rules consistently to the on-screen form, browser print, and Print Form PDF capture.

4. **Keep document exports consistent**
   - Ensure PDF generation waits for the prepared logo to finish decoding before capturing the Print Form.
   - Pass the same prepared logo to DOCX generation with proportional dimensions rather than forcing a distorted width and height.
   - Leave Preview PDF generation, Print Form content, approval details, comments, tables, and all actions unchanged.

## Verification
- Open a Print Form with a dynamically returned logo and confirm it is sharp, proportional, right-aligned, and does not overlap the company name.
- Download the Print Form PDF and inspect the logo at normal and enlarged zoom.
- Verify browser Print and DOCX retain the same logo proportions and clarity.
- Confirm missing-logo behavior remains non-blocking and no other Print Form layout or functionality changes.
