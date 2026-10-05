# Permanently restore complete Print Forms for every approval level

## Confirmed cause

The saved-detail fallback currently reads the NFA and approval levels as the signed-in user. The approval-level access rule only exposes an approver's own row, while the Initiator can read the complete chain. This makes the fallback incomplete for later approvers; failures are then silently converted to empty details, allowing the recurring “Function, Approval Chain” warning.

## Implementation

1. Keep the Print Form layout and all SAP-first behavior unchanged.
2. Secure the saved Print Form context with the existing **Approvals** screen permission, then load the selected NFA header and its complete ordered approval chain on the server.
3. Return only the fields already required by the Print Form; do not expose unrelated user or record data.
4. Continue giving current SAP responses priority, using saved NFA values and all saved approval levels only when SAP omits fields.
5. Stop silently losing the fallback: preserve safe diagnostics and ensure a partial SAP response cannot erase Function or any approval level.
6. Apply the same resolved document to the on-screen Print Form and approval/rejection PDF generation so every level behaves consistently.

## Verification

- Add coverage proving a non-Initiator approver receives Function and the complete ordered approval chain.
- Verify current SAP values still override saved fallback values.
- Verify users without Approvals permission cannot access this data.
- Verify the Print Form preview and generated PDF use identical complete details.
- Run the focused Print Form and approval-flow tests and confirm the application build is healthy.

No records, roles, permissions, SAP settings, workflow actions, or existing screens will be removed or changed.
