# Fix: Approvers not loading after choosing Plant

## What's actually wrong (I checked both)
1. **The Approvers window waits for all three: Plant, NFA Type and Function.** Your screenshots have Plant chosen but NFA Type still "Select type", so the window never calls SAP. All it shows is "Select Project, NFA Type and Function to see the approvers."
2. **The new SAP API isn't in SAP API Settings yet.** Only "Approval Chain", "Approval flow in Detailed Description" and "Logo in Detailed Description" are there. "Approver Get Detail" is missing, so even a full selection would fall back to the old lookup.

## Fix
- Call SAP as soon as **Plant** is chosen. The call is sent again whenever Plant or Predefined/Dynamic changes. Payload: `{ "get_detail": { "check": "X" or "", "plant": "<plant>" } }`.
- Show what SAP returns straight away:
  - Before NFA Type and Function are chosen, list every chain SAP returns for that Plant, each with its NFA Type / Function label.
  - Once they're chosen, narrow to the matching chain, as today.
  - Show SAP's message, or "No approvers returned by SAP", when the reply is empty. The window will never sit there silently.
- Add the **Approver Get Detail** entry to SAP API Settings for you. It uses method GET and path `/e-nfa/enfa_report//create?sap-client=300`, with the same SAP system and login as the existing Approval Chain entry. You can still edit it on the API Settings screen.
- Ticks still choose who goes into the Create NFA payload. Nothing ticked carries over from a different chain.

## Verification
- Call the new API with Plant 9000 for both `check` values and confirm the reply matches your sample (5 levels, SCM HEAD to GROUP CFO).
- Add a test for showing chains when only Plant is chosen.

## Not changed
Create NFA submit payload, Approval Chain admin screen, Approvals, Print Form and emails.

## Technical details
- `ApproverSelector.tsx`: fetch on `plant` + `check` only. Keep the raw chain list, then filter by type and function (shown grouped when unfiltered). Reset ticks when the visible chain set changes.
- `sap-approval-flow.ts`: `fetchSapApproverDetail` returns all chains plus a `pickApprovalChain` helper. The fallback still runs only on 424.
- Migration: insert the `sap_endpoint` row (copy `system_id` and credentials from "Approval Chain"; `ON CONFLICT`/`WHERE NOT EXISTS`). Mirror it into `deployment/Quality/backend/migrations/9700_approver_get_detail.sql`.
