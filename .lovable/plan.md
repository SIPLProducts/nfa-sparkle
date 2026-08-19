# Approval Chain tab: simplify to Company Name

Trim the Approval Chain editor so a chain is just a company plus its ordered approver levels.

## Changes

- **Chain name → Company Name**: same free-text field, relabelled to "Company Name *" with a company-style placeholder. Table column header becomes "Company".
- **Remove "Applies to user"** and **"Applies to role"** selects from the dialog, and drop the "Applies to" column from the chains table.
- **Remove the Active switch** from both the dialog and the table row. Every saved chain is always active.

## Technical notes

- UI-only edits in `src/components/admin/ApprovalChainTab.tsx`: remove the owner/role selects, the `Applies to` and `Active` table cells, the `is_active` field from the draft state, and the now-unused role query, `Switch` import and `setApprovalChainActive` usage.
- `saveApprovalChain` keeps its existing signature; the client always sends `owner_user_id: null`, `role_key: null`, `is_active: true`.
- No database migration: `owner_user_id`, `role_key` and `is_active` stay on `approval_chain` (nullable / default true) and are simply not surfaced. `setApprovalChainActive` remains available server-side but is no longer called.
