# Predefined uses the old Approval Chain list; Dynamic uses the Dynamic Approvals API

## What changes for you
- **Predefined Approvers:** works exactly as before today's changes.
  - The approvers come from the existing **Approval Chain** API.
  - They appear once Plant, NFA Type and Function are chosen.
  - The matching chain is shown with all approvers ticked.
  - The hint reads "Select Project, NFA Type and Function to see the approvers."
- **Dynamic Approvers:**
  - Choosing a Plant calls your **Dynamic Approvals** API with `{ "get_detail": { "check": "", "plant": "<plant>" } }`.
  - All approvers SAP returns are listed with their NFA Type / Function label, and none are ticked.
  - Choosing an NFA Type and Function narrows the list to that chain.
  - An empty reply shows SAP's message.
- Switching between the two options reloads the list from the correct API and clears ticks from the other option.
- The minimum of 2 approvers still applies to both options. The Create NFA submit payload is unchanged: the ticked approvers plus `check` ("X" for Predefined, "" for Dynamic).

## Not changed
The Approval Chain API and its payload, the Dynamic Approvals payload, User Management, Approvals, Print Form and emails.

## Technical details
- `ApproverSelector.tsx`: branch on `check`.
  - `"X"`: restore the original effect, which calls `fetchSapApprovalChain({ plant, nfaType, functionName })` only when all three are set and ticks every level.
  - `""`: keep the current `fetchSapApproverChains` + `filterApproverChains` path.
  - Reset state whenever the mode changes.
- `_authed.nfa.new.tsx`: the card hint follows the mode. Predefined shows the old three-field hint; Dynamic shows "Select a Plant…".
- Add a test that the Predefined option sends `check` "X" and the Dynamic option sends "" through `approverModeCheck`. The existing tests stay.
