# Budgeted (Dynamic) Approvers: Role + Range matching

## What changes
- The approver list shows only users whose role is **Approver** (custom or system approver role). Admins never appear, even if they also hold Approver. The initiator is never listed.
- Instead of an exact range match, an approver is listed when their From–To range **overlaps or contains** the initiator's range.
  - Example: Prasad (Initiator, 1000–2000) sees Sunil (1000–9000) and Sampath (1000–5000).
  - Rule: approver.From <= initiator.To AND approver.To >= initiator.From.
- The range filter dropdown keeps working: choosing a range lists approvers overlapping that range (defaults to the initiator's own range).
- Inactive users stay excluded. Selection, level-wise ordering, Predefined flow, payloads and SAP calls are unchanged.

## Technical details
- `src/lib/series-approvers.ts`: add pure `rangesOverlap(a, b)` and `isApproverRole(role)` (`approver`, `custom_approver`); replace `filterSeriesApprovers` with a filter taking the target range, each user's range (via `company_series` lookup), approver-id set and admin-id set.
- `src/lib/series-approvers.functions.ts` `listSeriesApprovers`: load all `company_series` rows, resolve the target range, fetch active profiles whose assigned range overlaps, then load roles from `user_role_assignment` + `user_roles` to keep approvers and drop admins.
- Tests in the existing series-approvers test file: Prasad/Sunil/Sampath example, non-overlapping range excluded, non-approver excluded, admin+approver excluded, caller excluded.
- No database migration.
