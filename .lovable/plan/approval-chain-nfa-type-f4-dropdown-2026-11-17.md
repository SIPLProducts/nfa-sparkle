# Approval Chain: NFA Type F4 dropdown

## What changes
- In User Management → Approval Chain, the **NFA Type** text box becomes a searchable dropdown.
- Options come from the same SAP "ENFA Type F4" service Create NFA already uses.
- The saved value stays the same NFA Type code, so saving, editing, the required check and the SAP payload don't change.
- If an existing chain has a type that isn't in the list, it is still shown and kept.
- While the list loads you see "Loading…". If SAP fails, you see a short message and can still type the value by hand, so editing is never blocked.

## Technical details
- `src/components/admin/ApprovalChainTab.tsx`: replace the `Field` for `funct` (line ~215) with a combobox (Popover + Command, the same pattern as the existing PlantCombobox).
- On mount it fetches `POST /api/public/sap-enfa-type` with the session bearer and parses with the existing `parseEnfaTypeF4`, the same as `_authed.nfa.new.tsx`.
- `updateField("funct", code)` stays unchanged.
- No server, API, database or validation changes.
