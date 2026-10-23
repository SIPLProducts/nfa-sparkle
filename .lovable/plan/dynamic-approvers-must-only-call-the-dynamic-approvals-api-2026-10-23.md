# Dynamic Approvers must only call the Dynamic Approvals API

## Why the Predefined list appears under Dynamic
In Dynamic mode, the window first calls the Dynamic Approvals API. If that call fails for any reason, it quietly falls back to the Predefined Approval Chain API. That safety net was added so the screen wouldn't break before the new API was registered. Failure reasons include the entry not being found, SAP returning an error, or a timeout.

Your screenshot shows exactly that fallback: four ticked levels with no "NFA Type / Function" column. So on your server the Dynamic Approvals call is failing, and the failure is hidden behind the Predefined list.

## Fix
- **Dynamic Approvers** calls **only** the Dynamic Approvals API, with `{ "get_detail": { "check": "", "plant": "<plant>" } }`. It never falls back to the Approval Chain API.
  - If SAP answers, its approvers are shown, as now.
  - If the call fails, the window shows the real reason. For example, the API isn't registered or active in SAP API Settings, or SAP's own error message. That way you can see and fix it.
- **Predefined Approvers** stays exactly as now and only calls the Approval Chain API.
- Each result is tied to the option that requested it. A late reply after you switch options is ignored, so a list can never show under the wrong option.

## After deploying
Open Create NFA, choose a Plant, then pick Dynamic Approvers. If an error appears, it names the problem, most likely the Dynamic Approvals entry's path, method or login. Send me that message if it isn't clear.

## Not changed
API payloads, the Predefined flow, the minimum of 2 approvers, the Create NFA submit payload, and all other screens.

## Technical details
- `ApproverSelector.tsx`: remove the 424 → `fetchSapApprovalChain` fallback effect and the `fallback` use in Dynamic mode. On a 424, show the server's `error` text.
- `sap-approval-flow.ts`: on 424, `fetchSapApproverChains` throws with the server's error instead of returning `chains: null`.
- Add a test: when the Dynamic API fails, the Approval Chain API is not called (mock `fetch` and assert only `/api/public/sap-approver-detail` is requested).
