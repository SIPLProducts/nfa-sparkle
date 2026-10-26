<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Approval and Reject PDF attachments use the shared Print Form generator and settings-driven payload builder so SAP receives current record data without hardcoded values.
- Quality backend recovery must select exactly one deployed Compose file and preserve the existing database volume, because mixing stack definitions or recreating volumes risks data loss.
- Quality SAP API synchronization must use a standalone, rerunnable upsert migration that preserves endpoint identities, credentials, SAP systems, and application records.
- Transient notifications and destructive confirmations use the shared SweetAlert layer so messaging stays consistent without changing workflow logic.
- Route-specific viewport scrolling is controlled by AppShell using the active pathname so fixed data controls do not alter other screens.
- User deletion is server-authorized; unlinked accounts are removed permanently, while linked accounts lose access and disappear from User Management so workflow history remains intact.
- Authentication access checks remain pending until the current user's shared role-and-permission load completes, preventing transient false denials.
- Global styles use both the root module import and the root head link so route reloads cannot leave the portal unstyled.
- Authorization uses dynamic Custom Role assignments; legacy System Role storage remains inactive for schema compatibility.
- Screen authorization uses the assigned Custom Role permission for both page access and its server-side actions so delegated users receive the screen's complete existing functionality.
- Approval Chain management uses the configured SAP endpoint and serializes editable rows into SAP's seven approval slots so no business values are hardcoded.
- Approval Chain reads require Approvals access, while approval-chain mutations require User Management access, so Print Form works without granting administrative rights.
- Approver Print Forms authorize through the Approvals screen permission, then merge current SAP responses with the complete server-read saved NFA and ordered approval levels, using saved values only when SAP omits them.
- Optional Print Form SAP refreshes must never block saved-detail rendering or expose raw gateway error pages.
- Approval Print Form comments are merged by approval level from SAP and the complete permission-checked saved chain, then shared by preview and workflow PDFs.
- Preview uses an explicit response classifier and Preview-only request mode; X Preview and Approvals display share complete read-only Print Form preparation and optional logo loading, preventing sparse SAP details from dropping sections while leaving workflow PDFs unchanged.
- Application-generated Print Forms share an overall-status watermark helper across display, printing, and PDF export; PDF staging suppresses the display overlay to preserve one existing watermark per page.
- SAP attachment response parsing lives in a pure shared helper so SAP field compatibility can be regression-tested without loading authenticated server routes.
- Attachment-read Swal notifications target the active dialog through the shared notification helper so modal focus and pointer handling remain intact; other notification callers retain their default behavior.
- My NFAs Edit uses a shared tested SAP Edit parser and payload builder, with server-resolved signed-in User ID and selected record number, so connection credentials and saved sample values never establish the Edit identity.
- Email Configuration persists SMTP settings via sap_api-guarded server functions in the locked sap_secret table; workflow emails are sent server-side after SAP accepts an action and never block it.
- Workflow email recipients are resolved server-side after SAP accepts an action: the initiator and chain come from SAP's record Select (tried as portal users, since SAP answers only for the initiator) and approval flow, with the screen's values as fallback; every attempt is written to the locked email_log table with its level and data source.
- SMTP sending (middleware relay and portal direct send) pre-resolves the mail host with OS, public-DNS and last-good fallbacks plus one retry, because the mail library's own DNS query fails outright on transient timeouts.
