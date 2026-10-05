# Restore reliable Print Form loading

## Confirmed issue
Opening the Print Form now starts optional SAP requests for the company logo and approval chain. If the ngrok gateway returns an invalid or incomplete response, the dialog catches that failure but displays the raw gateway message in a blocking SweetAlert. The saved Print Form data is already designed to remain available, so an optional refresh failure should not interrupt the form.

## Plan
1. Reproduce the Print Form request sequence and identify whether the failing request is the logo, approval-chain refresh, or both.
2. Remove the duplicate approval-chain refresh from the Approvals Print Form path; use the already resolved SAP-first data prepared before the dialog opens.
3. Keep saved NFA details, Function, ordered approval levels, approver names, statuses, dates, times, and comments as the fallback whenever SAP omits data or the gateway is unavailable.
4. Make optional logo and approval-chain failures non-blocking inside the Print Form. Keep the form open and fully usable instead of showing the raw `ERR_NGROK_3004` alert.
5. Preserve current SAP priority: fresh SAP values still replace saved fallback values when SAP responds successfully.
6. Add focused regression coverage for gateway failure, complete saved-detail rendering, SAP-over-saved priority, and no duplicate approval-chain request.
7. Verify the Approvals Print Form, PDF download, Print action, Initiator Print Form, and approval/rejection document generation remain unchanged.

## Technical scope
- Limit changes to Print Form data orchestration and optional-resource error handling.
- Do not change SAP endpoint settings, workflow actions, permissions, users, records, database data, or the document layout.
- Keep actionable failures visible only when the core Print Form cannot be assembled; optional SAP refresh failures will use existing saved details silently.
