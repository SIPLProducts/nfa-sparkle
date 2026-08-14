# Report screen: simplify filters

## Changes

- Remove the **ENFA No** from/to pair.
- Remove the **Approver IDs** from/to pair.
- **ENFA Type**: single dropdown instead of a from → to pair.
- **Function**: single dropdown instead of a from → to pair.
- Plant and Date range stay as from → to ranges; status checkboxes unchanged.

Remaining filter grid: Plant (from → to), ENFA Type (single), Function (single), Date range (from → to).

## Payload behaviour

SAP still receives the same 15 keys, so nothing changes server-side:

- `nfano_from`, `nfano_to`, `usrid_from`, `usrid_to` are always sent as empty strings.
- ENFA Type value is sent in both `funct_from` and `funct_to`; blank means both empty (all types).
- Function value is sent in both `extra_from` and `extra_to`.

## Technical notes

- Edits confined to `src/routes/_authed.report.tsx`: drop the two `RangeInput` usages for ENFA No and Approver IDs, replace the two `RangeSelect` usages with single `Select` controls that write both range keys, and remove `RangeInput`/unused helpers if no longer referenced (Date range keeps `RangeInput`).
- No change to `/api/enfa-report`, `sap-report.server.ts`, or the endpoint config.
