# Print Form PDF border and DRAFT alignment

## Scope
Update only the downloaded Print Form PDF framing and watermark. Keep the existing document content, page splitting, logo, header, approvals, comments, spacing, and all application behavior unchanged.

## Changes
1. Draw the outer page frame directly in the PDF after each page image is placed, slightly inset from the content edge so all four sides remain visible and sharp.
2. Keep the current A4 margins and footer position, avoiding any change to the document’s internal layout.
3. Increase the diagonal **DRAFT** watermark and adjust its centered placement and angle to more closely match the reference PDF, while retaining a light grey appearance that does not obscure content.
4. Apply the same frame and watermark treatment consistently to every generated page.

## Verification
- Download the Print Form PDF through the existing button.
- Render every generated page and visually confirm the top, right, bottom, and left borders are continuous.
- Compare the DRAFT size, angle, and position with the first reference PDF.
- Confirm the logo, header details, approval grid, comments, footer, pagination, and dynamic data remain unchanged.
- Run the focused Print Form checks and type validation.

## Technical details
The page content is currently inserted as a JPEG, so a one-pixel border at the image edge can fade during scaling. The fix will add a vector rectangle in the PDF itself rather than relying on the captured image edge. The watermark remains a PDF text overlay, with only its size and placement adjusted.
