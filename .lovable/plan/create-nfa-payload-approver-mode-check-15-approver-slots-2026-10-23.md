# Create NFA payload: approver mode `check` + 15 approver slots

## What changes
When you press Submit on Create NFA, the request sent to SAP will also carry:

- `check`: `"X"` when **Predefined Approvers** is selected, `""` (blank) when **Dynamic Approvers** is selected.
- `design1`..`design15` and `approve1`..`approve15`: the approvers ticked in the Approvers panel, in order (designation + User ID), with blanks for unused slots — exactly like the sample you shared.

Everything else in the payload (user_name, company, plant, NFA type, function, subject, impacts, text, files), the SAP endpoint, attachments, messages and every other screen stay as they are.

## Technical details
- `src/lib/sap-api-constants.ts`: extend `wrapCreatePayload` to emit `design1..15` / `approve1..15` (using `MAX_APPROVAL_LEVELS`) and a trailing `check` value; update `CREATE_BODY_SAMPLE` so API Settings shows the same shape. Existing keys keep their current casing so the working SAP contract is not altered.
- `src/routes/_authed.nfa.new.tsx`: capture the Approvers panel selection via its existing `onChange`, and add `check` (from the radio choice) plus the approver slots to the Create payload.
- `src/routes/api/public/enfa-create.ts`: pass the approver list and `check` through unchanged to the payload builder.
- Add a small test: Predefined -> `check: "X"`, Dynamic -> `check: ""`, 2 selected approvers fill slots 1-2 and 3-15 are blank, more than 15 is rejected.

## Open point
Dynamic mode currently uses the same Approvers panel (no free selection yet), so its approver slots carry whatever is ticked there.
