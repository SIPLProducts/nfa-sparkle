# Show the Approval Chain in Print Form Preview for Dynamic Approver NFAs

## Cause (confirmed)
NFA 100269 was created with **Dynamic Approvers**, so NFA Type and Function are empty by design (the Print Form shows them blank). The Print Form only asks SAP for the approval chain when Plant, NFA Type **and** Function are all filled in. With those two blank, it never asks, so the chain boxes are empty. With no chain, the comments list has no approver names to show either.

Your Postman call (check "", werks 9000, blank nfa_type/funct, enfa_no 100269) returns the chain (site head / 1001, SCM HEAD / 9002), so SAP has the data; the app simply never sends that request.

Predefined NFAs are not affected.

## Fix
- When NFA Type or Function is blank, the Print Form still asks SAP for the chain using the Plant and the NFA number. It uses the same Approval-flow API and the same request fields the Dynamic flow already sends (`check: ""`, plant, `enfa_no`). Blank NFA Type and Function are sent as empty, as SAP already gets them in Dynamic mode.
- Predefined records keep today's checks and request exactly as they are.
- The levels, User IDs, approver names, dates (DATE1–DATE15) and comments with names then fill in like they do for Predefined records. This covers Preview, the Approvals view and the PDFs, because they all share one preparation step.

## Not changed
SAP payload structure, endpoints, Predefined logic, Create NFA, workflow actions and layout.

## Technical details
- `src/lib/prepare-web-print-form.ts`: call `fetchResolvedSapApprovalFlow` when a plant exists. Today it also requires `nfaType`.
- `src/lib/sap-approval-flow.ts` `fetchSapApprovalFlow` / `fetchResolvedSapApprovalFlow`: allow blank nfaType/functionName when `enfaNo` is given.
- `src/routes/api/public/sap-approval-flow.ts`: nfaType/functionName may be empty only when `enfaNo` is present and the saved mode is `dynamic`. Otherwise keep returning the existing 400.
- Add a test: a dynamic input with blank type/function still builds the flow request.
