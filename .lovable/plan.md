# Budgeted approvers from the signed-in user's Series

## What changes
- With **Budgeted** selected, the Approvers list loads only after both **Company** and **Plant** are chosen (today it loads after Company alone).
- The list is driven by the **signed-in user's own Company Series** (e.g. Series with range 9000–9990), not by working out a Series from the chosen Company.
- It shows every active user in User Management assigned to that same Series, excluding anyone with the Admin role and excluding the signed-in user themself.
- The user ticks approvers from this list; tick order sets approval levels and approver names exactly as today.
- Works the same for every non-Admin role.
- Clear empty messages: "Your account has no Series assigned" or "No approvers are assigned to your Series".

## Unchanged
Non Budgeted flow, SAP payloads (including name01/name2–name15), validations, submit, and all other screens.

## Technical details
- `src/lib/series-approvers.functions.ts`: read the caller's `profiles.company_series` via `context.userId`; drop the company-range lookup; keep the Admin filter; also exclude the caller. Input still accepts company/plant (used only as a trigger).
- `src/routes/_authed.nfa.new.tsx`: call `listSeriesApprovers` only when mode is Budgeted and both company and plant are set; clear selection when company/plant/mode changes.
- Update `src/lib/series-approvers.test.ts`: caller's series selects users, admins excluded, caller excluded, no-series returns empty.
