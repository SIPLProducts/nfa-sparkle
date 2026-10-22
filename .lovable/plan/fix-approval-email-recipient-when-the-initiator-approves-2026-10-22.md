# Fix approval email recipient when the initiator approves

## Cause (confirmed in code)
The email step works out the acting person's level by finding their User ID in the record's approval chain. The initiator is not in the chain, so the lookup falls back to level 1. The "next approver" is then taken as level 2, which skips the first approver.

The email step also reads only 7 chain levels, while chains now allow 15.

## Fix
- When the person who clicked Approve is the record's initiator and is not in the chain, treat them as level 0. The email then goes to the **first** configured approver.
- An approver at level N continues to email the next non-empty level after N. The last approver continues to email the initiator ("Fully approved").
- If someone is neither the initiator nor in the chain, keep the current fallback behavior.
- Read and match all 15 chain levels when building recipients.
- Reject, Back to Initiator, and Clarification stay the same. If the initiator triggers Clarification, it goes to the initiator only, because no approvers have acted yet.
- No changes to SAP calls, payloads, permissions or hardcoded addresses.

## Technical
- `src/lib/workflow-mail.server.ts`:
  - `actingLevel` gains an initiator list. It returns 0 when the actor matches the initiator and not a chain slot.
  - `pickRecipients` allows level 0, so `next = approvers[0..]`.
  - Change the chain array size from 7 to `MAX_APPROVAL_LEVELS` (15).
- Tests in `src/lib/workflow-mail.test.ts`:
  - Initiator Approve goes to approver 1.
  - Level 1 goes to level 2.
  - Last level goes to the initiator.
  - A 15-level chain works.
- Deployment: web only.
