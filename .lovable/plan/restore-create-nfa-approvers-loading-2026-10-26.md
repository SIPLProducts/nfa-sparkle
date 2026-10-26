# Restore Create NFA approvers loading

## What's wrong
The approver API entry in SAP API Settings was renamed yesterday from **Dynamic Approvals** to **Approvals In create** (it also starts with a stray space). The Create NFA screen only looks for "Dynamic Approvals", "Approver Get Detail" or names containing those words. So it no longer finds the entry and the Approvers window loads nothing. The API, path, method and payload are the same ones that worked yesterday.

## Fix
- The Create NFA screen finds the approver API by what it does, not only by its name. It uses the first active entry that matches, in this order:
  1. The names that already work: Dynamic Approvals, Approver Get Detail.
  2. **Approvals In create**, which is your current name. Leading and trailing spaces are ignored.
  3. Otherwise, any entry whose request template uses `get_detail`.
- The "Dynamic Approvers List" entry used by User Management is never picked up for this.
- The request and the screen behaviour are the same as yesterday:
  - The request is `{ "get_detail": { "check", "plant", "nfa_type", "funct" } }`.
  - Predefined and Dynamic still show the approvers and ticks as they did.

## Not changed
- The Create NFA submit payload
- User Management's Dynamic Approvers tab
- Approval Chain, Approvals, Print Form and emails
- Your SAP API Settings entries. Nothing is renamed or overwritten.

## Technical details
- `sap-api-constants.ts`: add `"%approvals in create%"` to `APPROVER_DETAIL_ENDPOINT_NAMES`. Use `%` wrapping so the leading space matches.
- `callApproverGetDetail` in `sap-report.server.ts`: after the name patterns, fall back to an active entry with `request_body ilike '%get_detail%'`, excluding "Dynamic Approvers List".
- Extend `sap-approver-detail.test.ts` to cover the new name, then run the tests.
