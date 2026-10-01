# Remove Detailed Description from Preview

## Scope
- Update the shared Preview dialog used by **My NFAs**, **Approvals**, and **E-NFA Report**.
- Remove the **Detailed Description** section from the Preview fallback content on every screen.
- Remove the now-unused local draft lookup and rich-text Preview dependency associated only with that section.

## Preserve
- Keep SAP document loading, fallback/error handling, Open in new tab, Download, Print, and Close actions unchanged.
- Keep the separate **Print Form** and its Detailed Description content unchanged.
- Make no API contract, workflow, database, page-layout, or other feature changes.

## Verification
- Confirm the shared Preview no longer contains Detailed Description.
- Confirm all three screens still use the same Preview dialog and retain their existing actions.
- Check the application build for errors.
