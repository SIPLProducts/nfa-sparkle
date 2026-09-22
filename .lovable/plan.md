# Improve Print Form logo clarity

## Goal
Make the dynamically loaded company logo sharp and consistent in the on-screen Print Form and downloaded Print Form PDF, while preserving the reference PDF’s logo position, size, alignment, and all other document behavior.

## Confirmed current state
- The Print Form obtains the company logo dynamically from the configured SAP logo endpoint using Company Code; no fixed logo mapping is used.
- The browser converts non-PNG logo responses to PNG at their original dimensions and displays them inside a fixed 120 × 58 px, right-aligned header area with aspect ratio preserved.
- PDF generation waits for images, but then rasterizes each complete A4 page and inserts it into the PDF as a quality-reduced JPEG. This additional lossy conversion can soften the logo even when the prepared source is clear.
- The staged PDF pages clone the same logo shown in the Print Form, so the source and placement can remain shared.

## Implementation
1. **Prepare one export-quality logo**
   - Decode and validate the dynamic SAP image before display.
   - Preserve a lossless PNG representation and the source aspect ratio.
   - Prepare enough pixel density for the existing 120 × 58 px display area without changing its visible dimensions or enlarging it disproportionately.
   - Keep missing-logo behavior non-blocking and retain the existing API/settings flow.

2. **Use the same logo consistently**
   - Continue passing the single prepared logo to the shared Print Form renderer so the preview and staged PDF pages cannot diverge.
   - Keep the current right-aligned frame, maximum dimensions, clear space, and `object-fit: contain` behavior.
   - Ensure PDF generation waits for the staged logo to finish loading and decoding before capture.

3. **Avoid quality loss in the downloaded PDF**
   - Replace the page image’s lossy JPEG encoding with a lossless capture path, or overlay the lossless logo after page capture if that produces a smaller and more reliable result.
   - Preserve the current A4 pagination, four-sided frame, DRAFT watermark, footer, margins, tables, approvals, comments, and page breaks exactly as they are.
   - Apply no sharpening filter or forced width/height that could create halos, stretching, or distortion.

4. **Focused verification**
   - Open a Print Form with a dynamically returned logo and confirm the preview logo is sharp, proportional, fully visible, and aligned like the reference.
   - Download the actual Print Form PDF and inspect the logo at normal and enlarged zoom.
   - Compare preview and PDF dimensions/aspect ratio and verify no clipping, blur from JPEG compression, stretching, or position shift.
   - Visually inspect every generated PDF page and confirm borders, header fields, Detailed Description, approvals, comments, watermark, footer, and pagination remain unchanged.
   - Run the existing Print Form/logo tests and type checks.

## Scope protection
- No hardcoded logo, company mapping, or replacement branding.
- No changes to SAP settings, workflow actions, saved data, document content, DOCX behavior, or other screens.
- The uploaded screenshot is a visual reference only and will not be embedded in the application.
