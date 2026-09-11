# Fix Repeated Microsoft Word Connector Errors

## Confirmed root cause

- The eNFA application is loading normally; the screenshot error is shown in Lovable’s builder panel, outside the application preview.
- The Microsoft Word App User Connector is available for this workspace, but its client list is empty.
- Two fresh attempts to open the Microsoft Word setup card were interrupted before the configuration form loaded.
- Therefore, this is not caused by the Print Form code, authentication data, SAP APIs, or the eNFA database. The blocking failure is the missing workspace Microsoft Word client combined with the Lovable connector setup card failing to load.

## Recovery steps

1. Do not change or remove any current eNFA functionality while the external setup is unavailable.
2. Have a workspace owner/admin open **Workspace Settings → App User Connectors** and create the Microsoft Word client there.
3. Configure the organization’s Microsoft Entra application with its tenant ID, application/client ID, client secret, and the documented Lovable callback URL.
4. Enable offline access and the Microsoft file permissions required to read, write, and convert DOCX files.
5. Return to this project and link the newly created Microsoft Word client.
6. Verify that the linked client appears in the workspace client list and that its project credentials are provisioned.

## If the setup screen still fails

- Treat it as a Lovable platform connector-service issue rather than an application bug.
- Send Lovable Support these exact facts: connector `microsoft_word`, empty client list, setup card error “An error occurred while loading the App User Connector,” repeated at approximately 12:41–12:47 UTC on 11 September 2026, plus the supplied screenshot.
- Do not repeatedly retry, alter application authentication, regenerate unrelated keys, or modify the eNFA database; none of those can create the missing workspace connector client.

## Resume implementation only after recovery

- Once the Microsoft Word client is visible and linked, implement the previously approved direct Word-for-web editing workflow.
- Then verify per-user Microsoft consent, direct DOCX editing and autosave, version storage, and Approver PDF conversion.
- Regression-test the existing Create, Edit, approvals, comments, attachments, reports, and SAP integrations.

## Current blocker

Implementation is blocked by external Microsoft/Lovable connector provisioning. No safe application-code change can repair a builder setup card that fails before credentials are configured.
