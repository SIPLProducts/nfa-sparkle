# Approval flow API: send ENFA number only for Dynamic approvers

The "Approval flow in Detailed Description" API (GET `/e-nfa/enfa_approval/APPROVAL?sap-client=300`, configured in SAP API Settings) fills the approvers on Preview, the Approvals screen PDFs and workflow emails.

## New payload rules

Predefined (check = "X") — no `enfa_no`:
```text
{ "get_data": { "check": "X", "plant": "9000", "nfa_type": "BUDGET DEVIATION", "funct": "PROJECTS" } }
```

Dynamic (check = "") — only the ENFA number, other fields blank:
```text
{ "get_data": { "check": "", "plant": "", "nfa_type": "", "funct": "", "enfa_no": "100221" } }
```

## How the app decides Predefined vs Dynamic
- A record counts as Dynamic when the approvers were picked with Dynamic Approvers at creation (already saved with the NFA, or listed for that ENFA in the Dynamic Approvals list). Otherwise it is Predefined.
- If a Dynamic call returns no approvers, the screen falls back to the current Predefined lookup so nothing goes blank.

## Reading the Dynamic reply
SAP's Dynamic reply (`REFFLD`, `DESIG1..15`, `USERID1..15`) is read as levels 1-15 in order, skipping empty slots. For 100221 that gives: site head (1001), MANAGER (9001), HR MANGAER (9002).

## Not changed
Predefined results, Approve/Reject/Clarification/Back to Initiator calls, Create NFA, emails' routing rules, other APIs.

## Technical details
- `sap-api-constants.ts`: pure `buildApprovalFlowPayload({ check, plant, nfaType, funct, enfaNo })` — "X" omits `enfa_no`; "" sends blanks + `enfa_no`. Merged over the saved request template (template's `enfa_no` removed for "X").
- `callSapApprovalFlow` (sap-report.server.ts) takes optional `enfaNo` + `check`; `/api/public/sap-approval-flow` accepts them (Zod).
- `fetchSapApprovalFlow` / `fetchResolvedSapApprovalFlow` accept `enfaNo` and mode; callers (`prepare-web-print-form.ts`, `approval-print-pdf.tsx`, `PrintFormDialog.tsx`, `workflow-mail.server.ts`) pass the record number and its mode from saved draft/dynamic list.
- `parseSapApprovalFlow` also accepts the `DESIGn/USERIDn` shape.
- Tests: payload for "X" has no `enfa_no`; payload for "" has only `enfa_no` filled; parser reads the 100221 sample as 3 levels.
