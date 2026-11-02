# Create ENFA payload: add approver name slots

## What changes
The Create ENFA request sent to SAP gets a name for each approver, in the same order as their designation and user ID:
- Approver 1: `design1`, `approve1`, `name01`
- Approvers 2–15: `designN`, `approveN`, `nameN`

Each name is the approver's full name from their portal user profile. If the name isn't known, or the slot isn't used, the value is empty.

Nothing else changes. The plant name stays in `name1`, so it never collides with approver 1's name. Every other field, the attachments, `check`, the predefined and dynamic approver flows, the emails and saved approvers all stay as they are.

## Technical details
- `src/lib/sap-api-constants.ts`: add an optional `name` to `CreateApprover`. `buildCreateApproverSlots` writes `name01` for slot 1 and `name{i}` for slots 2–15, right after `approve{i}`. The sample body in API Settings will then show the new keys too.
- `src/routes/api/public/enfa-create.ts`: after the approver list is put together, look up `profiles.full_name` by username (case-insensitive) for the chosen user IDs, using the signed-in client. Any `name` the browser sends is used first. Values already in `name01`/`nameN` are also read when the browser sends the SAP-wrapped shape.
- `src/routes/_authed.nfa.new.tsx`: pass the approver name when one is already known (no new lookups on the page).
- Update `src/lib/sap-create-payload.test.ts`: check that `name01` and `name2`..`name15` exist, are filled in order, and that `name1` still holds the plant name.
