# Restore the Stable State Before Word Online

## Confirmed restore point

Restore the application to the state immediately before the Microsoft Word Online request, while retaining the already-working:

- Print Form preview and alignment
- In-app Detailed Description editing
- DOCX download/upload and embedded images
- Approver PDF generation
- Existing Edit, approval, SAP, database, and attachment behavior

## Findings

- The attempted Microsoft Word connection did **not** modify any application source file, database object, API, or workflow.
- The “App User Connector error” is from the interrupted Microsoft setup card in the Lovable editor, not from the eNFA application.
- The login error is separate: the Demo Login server action requires `SUPABASE_SERVICE_ROLE_KEY`, but that server credential is currently unavailable to the preview runtime.
- Normal user login does not need the Demo Login account-creation action.

## Restore procedure

1. Use Lovable History to select the version immediately before the Word Online request.
2. Do not revert earlier DOCX, image, Print Form, alignment, Edit, or PDF work.
3. Do not alter APIs, database tables, approval flow, or SAP integration.
4. Reopen the preview after restoration so the failed connector card is cleared from the editor session.
5. Verify normal User ID/Email login with an existing account.
6. Verify Print Form preview, Detailed Description editing, DOCX download/upload, embedded images, Edit, alignment, and Approver PDF.

## Login recovery boundary

The missing service credential is environment configuration, not a recent Print Form code change. Restoring History will not create that credential. Keep normal login unchanged; treat Demo Login as unavailable until Lovable Cloud injects the server credential again. No private key will be added to source code or exposed in the browser.
