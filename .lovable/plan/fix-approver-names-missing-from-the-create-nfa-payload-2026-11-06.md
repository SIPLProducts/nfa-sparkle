# Fix: approver names missing from the Create NFA payload

## Root cause (confirmed)
- The approvers list SAP sends back has only each approver's User ID and designation. It has no names.
- The Approvers window does look up each approver's name to show in the "Approver Name" column. But that name only lives inside the window. It is never copied onto the selected approvers that are handed back to the Create screen (line 74 in the approver list sets `name: ""`).
- So when you click Submit, the screen builds the create request with `name01`, `name2`, `name3` ... all empty. This is exactly what your Network screenshot shows (approvers 1001, 9001, 9002 with blank names).
- The earlier fix filled the names in on the server, after that request and just before SAP. That fix only works where the latest version is published and deployed. It also means the browser's Network tab always shows empty names, which looks like the bug is back.
- All three approvers do have names saved in the portal: 1001 = akash A, 9001 = thiru sharvi, 9002 = prasad sharvi.

## Fix
1. Approvers window: when approvers are selected, attach each one's looked-up name (the same name shown in the "Approver Name" column) before passing them back to the Create screen. This works the same way for Predefined and Dynamic.
2. Create screen: no change needed. It already sends `a.name` into `name01` / `name2`…`name15`. Those slots will now carry the real names, so the Network tab and SAP will both show them.
3. Keep the server-side name fill as a backup for any approver whose name wasn't loaded yet.

Nothing else changes: same SAP address, same payload fields and order, same `check` value, same validations.

## Check
- Add a small test confirming that the selected approvers carry their names into `name01`, `name2`, `name3`.
- After publishing, make one Predefined and one Dynamic create and confirm in the Network tab that the names show up.

## Technical details
- `src/components/nfa/ApproverSelector.tsx`: when sending selected approvers to `onChange`, add `name: details[userId]?.name ?? ""`, and run it again when `details` finishes loading.
- `src/routes/api/public/enfa-create.ts`: unchanged (backup fill stays).
- Production needs a redeploy to pick this up.
