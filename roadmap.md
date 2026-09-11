# Quality deployment recovery

- [x] Route Quality browser assets through the working Node application.
- [x] Package complete root and `public` assets with the Node server bundle.
- [x] Use a local Ramky logo in self-hosted releases.
- [x] Publish complete frontend releases without merging stale hashed assets.
- [x] Add a non-destructive Quality database-role password repair.
- [x] Document activation, recovery, rollback, and verification commands.
- [x] Detect and regenerate invalid Quality API keys.
- [x] Apply the settings-file password and recreate Quality containers on repair.
- [x] Require a username and password on the Quality dashboard address.- [ ] Restore the deleted Quality compose file on the server (copy `deployment/Quality/backend/docker-compose.yml` via WinSCP), run `fix-db-roles.sh`, enable the dashboard login prompt — user to run on server.
- [x] Make Print Form Detailed Description editable for Initiators and downloadable as PDF for Approvers.
- [x] Generate and privately version editable Initiator DOCX working documents while keeping Approver output PDF-only.
- [x] Embed Print Form logo and Detailed Description images directly in downloaded DOCX files.
- [ ] Link a Microsoft Word App User Connector client — blocked because the workspace setup card fails before configuration and no client exists.
- [ ] Implement direct Word-for-web editing and DOCX-to-PDF conversion — blocked until the Microsoft Word client is linked and provisioned.
