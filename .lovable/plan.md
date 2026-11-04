## Lock Predefined approvers in the Approval Chain

When **Predefined** approval is selected, the approver list becomes read-only: no Select/Unselect checkboxes, and approvers stay fixed in SAP's order. Dynamic mode is unchanged.

### What changes (Create NFA > Approvers, Predefined only)
- Remove the checkbox column from the approver table.
- Show each approver's fixed position badge (#1, #2, …) in that column instead, so the sequence is still visible.
- Approvers stay automatically selected in SAP's order, as they are today. The user can't change this.
- The "Selected sequence" summary and the minimum-approver message stay as they are.

### What stays the same
- Dynamic Approvers: checkboxes, selection order and validation stay as they are.
- SAP calls, chain filtering, payloads, level numbering and validations stay as they are.

### Technical details
- `src/components/nfa/ApproverSelector.tsx` only: render the `Checkbox` only when `!predefined`. In Predefined mode, show the `#n` badge from the existing `checked` state. Don't use `toggle` in that mode.
- Predefined mode already auto-checks all levels when SAP returns one matching chain (`visible.length <= 1`). Keep that logic unchanged.
- Edge case: if SAP returns more than one matching predefined chain, nothing would be auto-selected and there'd be no checkboxes. In that case only, keep today's checkboxes so the form can still be submitted.
