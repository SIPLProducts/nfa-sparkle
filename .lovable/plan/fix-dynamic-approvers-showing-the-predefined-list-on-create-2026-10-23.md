# Fix Dynamic Approvers showing the Predefined list on Create NFA

## What the code does today
- The Predefined/Dynamic choice is passed correctly. Predefined sends `check: "X"` and Dynamic sends `check: " "` to the **Dynamic Approvals** API, along with plant, nfa_type and funct.
- Both options then show SAP's reply in exactly the same way. When only one chain comes back, every approver is ticked automatically, and the list is narrowed to the NFA Type and Function you picked.
- So in Dynamic mode the window looks the same as Predefined (3 approvers, all ticked, no NFA Type / Function column), even when SAP sent different rows. The code doesn't yet confirm whether SAP itself answers `" "` with the Predefined chain. Step 1 checks this.

## Fix
1. **Verify the call per mode.** Send the real request for Plant 9000 / IT ITEMS / PROJECTS once with `"X"` and once with `" "`. Record the exact body sent and SAP's reply for each, so we know whether the two replies really differ.
2. **Show the Dynamic reply as Dynamic.**
   - In Dynamic mode, list every row SAP returns for the request with its NFA Type / Function label. Nothing is ticked automatically, so the initiator picks the approvers.
   - Don't narrow the Dynamic list on the screen any more. SAP already received NFA Type and Function in the request.
   - Predefined stays exactly as it is now: SAP's chain, all ticked.
3. **No stale lists.** When you switch between Predefined and Dynamic, or change Plant, NFA Type or Function, the previous list and ticks are cleared at once. A late reply from the earlier selection is ignored.
4. **Show which mode was asked.** The Approvers window shows a small "Dynamic Approvers" or "Predefined Approvers" label, so it is clear which reply is on screen. SAP's message still appears when nothing comes back.

If step 1 shows SAP sends back the same rows for `" "` as for `"X"`, I'll report that to you as a SAP-side setting instead of hiding it.

## Not changed
The Create NFA submit payload, the rule of at least 2 approvers, the APIs and endpoints, and all other screens.

## Technical details
- `ApproverSelector.tsx`:
  - Use `filterApproverChains` only when `predefined` is true. In Dynamic mode, use the raw chains.
  - In Dynamic mode, the initial tick set is always empty.
  - Key the tick-reset effect on `check` as well as `levelKey`.
  - Clear `chains` synchronously when the mode changes.
- `sap-approval-flow.test.ts`: add tests that Dynamic sends `check: " "`, isn't filtered and starts with nothing ticked, and that Predefined sends `"X"`.
