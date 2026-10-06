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
- Preview uses a shared SAP-only source resolver: configured Preview PDF first, SAP record Detailed Description second, existing behavior last; explicit absence is distinct from upstream failure so outages cannot silently change the displayed source.
