# Quality deployment recovery

- [x] Route Quality browser assets through the working Node application.
- [x] Package complete root and `public` assets with the Node server bundle.
- [x] Use a local Ramky logo in self-hosted releases.
- [x] Publish complete frontend releases without merging stale hashed assets.
- [x] Add a non-destructive Quality database-role password repair.
- [x] Document activation, recovery, rollback, and verification commands.
- [x] Detect and regenerate invalid Quality API keys.
- [x] Apply the settings-file password and recreate Quality containers on repair.
- [x] Require a username and password on the Quality dashboard address.
- [ ] Restore the deleted Quality compose file on the server (copy `deployment/Quality/backend/docker-compose.yml` via WinSCP), run `fix-db-roles.sh`, enable the dashboard login prompt — user to run on server.
- [x] Make Print Form Detailed Description editable for Initiators and downloadable as PDF for Approvers.
- [x] Generate and privately version editable Initiator DOCX working documents while keeping Approver output PDF-only.
- [x] Embed Print Form logo and Detailed Description images directly in downloaded DOCX files.
- [x] Restore the stable state before the Microsoft Word Online request without reverting existing Print Form, Edit, DOCX image, alignment, or PDF functionality.

- [x] Make Initiator DOCX and Approver PDF share normalized sizing, content, and page dimensions.
- [x] Preserve image aspect ratios, cap images to printable width, retain merged table cells, and split multi-page PDFs on safe content boundaries.
- [x] Make the Approvals Print Form merge complete SAP details, local rich content, and approval-chain fallbacks before PDF rendering.
- [x] Keep SAP detail connection failures inside the dialog instead of opening a global 502 error page.
- [x] Restore Approver Data and Comments in the Approvals Print Form by resolving all existing SAP approval-field aliases with saved-comment fallbacks.
