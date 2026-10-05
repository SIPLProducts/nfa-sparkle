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
- Permanent user deletion is server-authorized and blocked whenever the account is linked to business records, preventing workflow-history loss.
- Authentication access checks remain pending until the current user's shared role-and-permission load completes, preventing transient false denials.
