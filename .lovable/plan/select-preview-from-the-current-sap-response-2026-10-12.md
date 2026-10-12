# Select Preview from the current SAP response

## Requested behavior
- Use the new Preview response only, replacing the previous DMS-first selection for Preview.
- A Base64 PDF response displays the SAP Print Form. The uploaded example contains Base64 PDF data, not a Base URL.
- An explicit `X` response displays the existing web application's Print Form for the selected record.
- No hardcoded record numbers, PDF contents, addresses, credentials, or business values.

## Confirmed current implementation
- Reports, My NFAs, and Approvals share `RecordPreviewDialog`.
- The SAP print request resolves the configured Preview endpoint, but its default request is currently `PRINT / EFNA_NO`.
- The response parser extracts Base64 documents but does not currently identify `X` as the web-form choice.
- The existing fallback checks SAP Detailed Description before rendering a web document; that check must not prevent the requested web Print Form when SAP returns `X`.

## Changes
1. On each Preview click, call the configured SAP Preview service using POST and the supplied structure: `{"preview":{"enfa_no":"<selected record number>"}}`. Retain settings-driven address, SAP system, and credentials; ensure a saved older template cannot send a stale record number.
2. Classify the successful response explicitly:
   - Valid Base64 PDF → render the SAP Print Form using the existing PDF viewer.
   - `X`, including a JSON-quoted string → load and show the existing web Print Form with the selected record's current saved details, approval chain, and comments through the shared permission-checked Print Form preparation.
3. Do not require SAP DD for the `X` branch or make another DMS-priority request. Preserve the web Print Form's existing layout and controls.
4. Handle failed calls, unexpected responses, and invalid PDFs as clear Preview errors—not as `X`. Clear the previous record's preview while loading and prevent late responses from showing the wrong record.
5. Keep standalone Print Form actions, approval/rejection payloads, attachments, editing, permissions, and other screens unchanged.

## Verification
- Test Base64 PDF and `X`, both raw and JSON-quoted responses.
- Confirm the outgoing request contains the clicked record's current eNFA number.
- Check Preview in Reports, My NFAs, and Approvals, including close/reopen and switching records.
- Confirm failures never silently select the web form and existing print/download actions still work for each displayed source.
- Run targeted tests and check compilation. A real SAP check requires connectivity to the configured company service; report separately if only controlled response tests are available.

## Technical scope
- Preview request construction in `src/lib/sap-report.server.ts` and response handling in `src/routes/api/public/enfa-print.ts`.
- Shared Preview response classification, PDF loading, and `src/components/report/RecordPreviewDialog.tsx`.
- Reuse the existing shared Print Form data preparation for the web branch; no schema changes or replacement business logic.
- Update the Preview requirement to reflect the explicitly chosen new-response-only behavior.