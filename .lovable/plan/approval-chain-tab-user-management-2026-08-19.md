# Approval Chain tab (User Management)

Add a fourth tab, **Approval Chain**, to the User Management screen so admins can define and manage ordered approval flows. Configuration only for now — Create NFA is not changed.

## What the tab does

- Lists all saved approval chains in a table: chain name, the user + role it applies to, number of levels, active toggle, edit / delete.
- **New chain** dialog / inline editor:
  - Chain name
  - Applies to: pick a user (from existing managed users) and a role (from existing role definitions)
  - Active switch
  - Levels: ordered rows (Level 1, 2, 3 …). Each level picks a specific user from the user list, with an optional designation text. Move up / move down / remove per row, plus "Add level".
- Validation: name required, at least one level, no duplicate user in two levels, levels renumbered automatically on reorder.
- Empty state, loading skeletons and toasts consistent with the other tabs.

## Data

Two new tables in the app database:

```text
approval_chain
  id, name, owner_user_id, role_key, is_active, created_by, created_at, updated_at

approval_chain_level
  id, chain_id -> approval_chain (cascade), level int, approver_id, designation text, created_at
  unique (chain_id, level)
```

RLS: admins only (via `has_role(auth.uid(),'admin')`) for select/insert/update/delete, with GRANTs to `authenticated` and `service_role`. `updated_at` maintained by the existing `touch_updated_at` trigger.

## Technical notes

- New server functions in `src/lib/approval-chain.functions.ts` using `requireSupabaseAuth`: `listApprovalChains`, `saveApprovalChain` (upsert chain + replace its levels in one call), `deleteApprovalChain`, `setApprovalChainActive`. Approver names resolved by joining `profiles`.
- New component `ApprovalChainTab` added inside `src/routes/_authed.admin.users.tsx` (same file pattern as `UsersTab` / `RolesTab`), wired as `<TabsTrigger value="chain">` with a `GitBranch` icon.
- Reuses the existing `listManagedUsers` and `listRoleDefs` queries for the user and role pickers.
- No changes to Create NFA, approvals, or SAP integration.
