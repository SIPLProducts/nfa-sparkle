# Use your "Dynamic Approvals" API entry for Create NFA approvers

## What's wrong
You saved the new SAP API in SAP API Settings as **Dynamic Approvals**. It has the right path (`/e-nfa/enfa_report//create?sap-client=300`), GET, Basic login and Active. The app only looks for an entry named **Approver Get Detail**. So it never finds yours, and on your server it falls back to the old Approval Chain lookup.

## Fix
- When the Approvers window asks SAP for approvers, it uses the first active entry it finds in this order:
  1. An entry named **Dynamic Approvals**, which is yours.
  2. An entry named **Approver Get Detail**, which I added here earlier.
  3. Otherwise, any entry whose name contains "dynamic approval" or "get detail".
- The method, path, SAP system and login all come from that entry, so nothing is hardcoded.
- The request body stays `{ "get_detail": { "check": "X" or "", "plant": "<plant>" } }`.
- **Trigger:** the call fires as soon as a Plant is chosen and again the moment you switch to **Dynamic Approvers** (sent with `check: ""`) or back to Predefined (`check: "X"`). You don't need to open the Approvers window first: the Approvers card loads in the background and shows the count or SAP's message straight away.
- **Response handling:** SAP's rows (PSPNR, FUNCT, EXTR_TXT, DESIG1..15 / USERID1..15) appear as approvers. An empty reply or plain-text message shows SAP's message, and an error shows the reason instead of a blank window.

## Not changed
How approvers are shown and ticked, the Create NFA submit payload, and every other screen and API.

## Technical details
- `callApproverGetDetail` in `src/lib/sap-report.server.ts`: name lookup in the order above (exact `ilike` first, then a wildcard fallback). It never matches by path, because other entries share that path.
- Add the "Dynamic Approvals" name to the regression test. No database change is needed: your server already has the entry, so you can skip migration 9700 there.
