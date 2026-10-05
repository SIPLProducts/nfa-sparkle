# Complete Print Form data for every approval level

## What will change
- Load the saved NFA header, Function, Initiator, and all saved approval levels whenever an approver opens Print Form.
- Merge those saved details with the latest SAP detail, report, and approval-chain responses, keeping SAP values first and using saved values only when SAP omits a field.
- Use the same merged document for on-screen Print Form and approval/rejection PDF generation.
- Keep all approval actions, permissions, SAP payloads, records, and other screens unchanged.

## Verification
- Add coverage for missing SAP Function and approval-chain fields being restored from the original saved NFA.
- Confirm current SAP values still take priority when present.
- Run Print Form, approval-flow, and approval-chain tests and confirm the build remains healthy.

## Technical details
- Add one authenticated Print Form context reader for the existing NFA and its ordered approvers.
- Extend the shared Print Form resolver with a saved-record fallback source rather than duplicating field mapping per approval level.
- Apply the shared resolver path both when opening Print Form and when creating workflow PDFs.
