# Quality deployment: changes since last deployment (16 Nov 2026) to now

## Database migrations
None. No new migration files since the last deployment. (0011, 0012, 0013 were already in the previous package.)

## Files to deploy (16)
Screens
- src/routes/_authed.admin.users.tsx (Range column, list refresh after Create User)
- src/routes/_authed.nfa.new.tsx (Scope/Budget/Timeline labels)
- src/routes/_authed.nfa.$id.tsx (labels)
- src/routes/_authed.nfa.$id.change.tsx (labels)

Components
- src/components/admin/ApprovalChainTab.tsx (NFA Type F4, DD.MM.YYYY dates)
- src/components/admin/RangeTab.tsx (Range without Series)
- src/components/nfa/ApproverSelector.tsx (range approvers, dropdown removed)
- src/components/document/EnfaDocument.tsx (labels)
- src/components/report/RecordEditDialog.tsx (labels)

Logic / server
- src/lib/company-series.ts
- src/lib/company-series.functions.ts
- src/lib/series-approvers.ts
- src/lib/series-approvers.functions.ts
- src/lib/enfa-docx.functions.ts (labels)

Tests
- src/lib/company-series.test.ts
- src/lib/series-approvers.test.ts

## Steps on Quality
1. git pull in the Quality folder.
2. No SQL to run.
3. Run the usual Quality deploy script (rebuild + restart app). No Nginx change.
4. Verify: User Management Range column, create a user, Approval Chain NFA Type dropdown, Budgeted approvers by range.
