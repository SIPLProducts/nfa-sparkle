# Fix Print Form permission warning

## What will change
- Keep the existing SAP approval-chain endpoint and behavior.
- Require **Approvals** permission when the Print Form reads approval-chain details.
- Continue requiring **User Management** permission when approval-chain settings are added, updated, or deleted.
- Return permission messages that match the requested operation.

## Verification
- Confirm an assigned approver can load Print Form approval details without the User Management warning.
- Confirm approval-chain management remains protected.
- Check the application build and existing approval-related tests.

## Technical details
- Parse the request mode before authorization and choose the existing screen permission accordingly: read request → `approvals`; management payload → `user_management`.
- Do not change users, roles, permissions, SAP payloads, saved records, or any unrelated screen.
