# Wire the Clarification button to SAP

The **Clarification Button** endpoint is already registered and active in Admin → SAP API Settings (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`) with the body template `{ "clarification": { "REFFLD": "...", "Comment": "..." } }`. Only the app-side wiring is missing — the Approvals screen currently shows "This action is not yet connected to SAP" for Clarification.

## What changes

- Clicking **Clarification** on the Approvals screen (with a record selected) opens the same remark dialog as Approve/Reject, then calls SAP.
- The request sends the selected ENFA number and the typed remark using the endpoint's saved template — nothing hardcoded; host, path, method, auth, query and body keys all come from API Settings.
- SAP's own reply (e.g. "Sent back to initiator for Clarification") is shown in the toast, and the worklist refreshes on success.
- Failures show SAP's error text inline instead of crashing the page, same as the other actions.

## Technical detail

1. `src/lib/sap-report.server.ts` — extend `callEnfaApprovalAction` action union with `clarification`, mapped to exact name `Clarification Button`, pattern `%clarif%`, wrapper key `clarification`. Existing template-merge logic (case-insensitive wrapper/REFFLD/Comment key lookup) is reused unchanged.
2. `src/routes/api/public/enfa-approve.ts` — add `clarification` to the allowed action list.
3. `src/routes/_authed.approvals.tsx` — include `clarification` in the branch that posts to `/api/public/enfa-approve`, with fallback message "SAP sent the record back for clarification"; keep the existing selection guard and remark dialog.
