# Workflow emails follow the SAP Dynamic Approvers for each ENFA

## What changes for you
- Before each workflow email is sent, the portal looks up that ENFA number in SAP's **Dynamic Approvers** list. This is the same data the Dynamic Approvers tab in User Management shows.
- If SAP has dynamic approvers saved for that ENFA, they set who gets each email, level by level:
  - **Create / Approve:** the next dynamic approver in order.
  - **Final approval:** the initiator, when the last dynamic approver approves.
  - **Reject and Back to Initiator:** the initiator.
  - **Clarification:** the initiator and the dynamic approvers before the current level, but not the person who raised it.
- This works for every NFA, including ones created before the portal started saving approvers. It also works from any machine, because SAP holds the list.
- If SAP has no dynamic approvers for an ENFA, emails follow the Predefined Approval Chain exactly as today.

## Order used to choose the approvers
1. Dynamic approvers from SAP for that ENFA.
2. The approvers saved by the portal when the NFA was created.
3. SAP's Predefined Approval Chain.
4. The approvers shown on screen.

## Not changed
- The Predefined flow
- Email content and design
- The SAP approval actions and their payloads
- The Dynamic Approvers tab
- Create NFA
- If the Dynamic Approvers lookup fails, the email still goes out using the next option in the order above. It never blocks the action.
- The email log records which source was used, e.g. `chain:sap-dynamic`.

## Technical details
- `workflow-mail.server.ts` / `resolveWorkflowContext`: before `loadSavedChain`, call `callDynamicApproversList(enfaNo)`, then parse it with `parseDynamicApprovers`. Pick the record whose `nfaNo` equals the ENFA number and map its levels to `chainIds[level-1]`. When that record has user IDs, it overrides both the saved chain and the predefined chain.
- Pure helper `dynamicChainIds(records, enfaNo)` in `sap-dynamic-approvers.ts`, with tests:
  - match by REFFLD
  - ignore other NFAs
  - return empty when there is no match
- Add a mail test confirming the level 1 → 2 → initiator routing with a dynamic chain.
- No database change. Uses the existing "Dynamic Approvers List" API Settings entry.
