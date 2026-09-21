# Dynamic Approval Details and Company Logo in the Print Form

## Confirmed current state

- SAP API Settings already contains active `GET` entries for **Approval flow in Detailed Description** and **Logo in Detailed Description**, both using the configured SAP system, Basic authentication, and `/e-nfa/enfa_approval/APPROVAL?sap-client=300`.
- The approval-flow entry has the expected `get_data` template with `plant`, `nfa_type`, and `funct`, but the Print Form does not currently call it. Create still builds Print Form approvers from the editable local list, while Edit and Approvals rely on record/worklist fields.
- The SAP approval-flow response maps levels through `DESIG1…DESIG7` and `USERID1…USERID7`.
- The company-logo entry is already connected to the Print Form through the selected Company Code. Its response is parsed as image data, displayed in the shared form, and converted for DOCX when needed.

## Changes

1. **Connect the configured approval-flow API to the Print Form**
   - Add one authenticated application endpoint that resolves the active `Approval flow in Detailed Description` entry from SAP API Settings.
   - Start with the saved request-body template and replace only `get_data.plant`, `get_data.nfa_type`, and `get_data.funct` with the selected form/record values.
   - Preserve the configured SAP system, URL/path, method, headers, query, credentials, timeout, and middleware routing; do not hardcode the supplied host or business values.

2. **Normalize the SAP approval response**
   - Parse direct, nested, or stringified SAP responses safely.
   - Map every populated `DESIG1…DESIG7` and `USERID1…USERID7` pair into ordered Print Form approval rows.
   - Keep any available approver names, statuses, action dates/times, and saved comments from existing record data; the new API supplies designation and User ID where those fields are absent.
   - Never invent an approver name when SAP returns only designation and User ID.

3. **Use the selected values on every Print Form path**
   - Create: call the approval-flow API with the currently selected Plant, NFA Type, and Function before showing the Print Form and before creating its DOCX.
   - Edit: use the loaded record’s Plant, NFA Type, and Function and merge the returned levels with existing saved approver data.
   - Approvals: use the selected worklist/full-detail values and merge the returned levels into the existing complete document resolver before showing the PDF form.
   - Prefer populated record-specific approval data; use the approval-flow response to fill missing fields, then retain existing saved-data fallbacks if SAP is unavailable.

4. **Keep the company logo dynamic**
   - Retain the existing company-logo API integration and pass the selected/resolved Company Code from Create, Edit, and Approvals.
   - Confirm the returned BMP/PNG/JPEG/GIF/WebP logo renders in the Print Form and PDF, and is converted to PNG for DOCX embedding.
   - Show no hardcoded logo fallback; a failed logo request leaves the logo area empty and reports the existing non-blocking warning.

5. **API Settings and deployment safety**
   - Keep both APIs editable and testable through the existing SAP API Settings screen.
   - Add guarded seed/upsert coverage for installations where either named endpoint is missing, without overwriting an administrator’s existing configuration.
   - Do not change database structure, approval actions, permissions, attachments, rich text, comments, PDF/DOCX layout, or unrelated workflows.

## Verification

- Test the approval-flow parser with the supplied seven-level response shape and nested/stringified variants.
- Verify changing Plant, NFA Type, or Function changes the API payload and the displayed approval rows.
- Verify Company Code changes request and display the corresponding logo with no static image fallback.
- Compare Create, Edit, and Approvals Print Forms, then confirm Initiator DOCX and Approver PDF contain the same dynamic approval details and correct logo.
- Regression-check existing rich text, tables, images, comments, Print, Download DOCX/PDF, and approval actions.

## Technical scope

The implementation will reuse the existing SAP settings and shared Print Form. Expected changes are limited to an approval-flow SAP helper and authenticated route, a reusable response parser/merge helper, the three Print Form callers, guarded endpoint seed data, and focused tests. The existing dynamic-logo path remains unchanged unless verification reveals a defect.
