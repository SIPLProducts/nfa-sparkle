# Integrate Dynamic Comments API into Print Form

## Confirmed current state

- The active **Comments_in_Printform** setting already has the supplied GET endpoint and request template `{ "comment": { "Reffld": "100006" } }`; its latest test succeeded and returned `COMMENT1` through `COMMENT6`.
- Print Form comments currently come from the SAP Preview PDF first, then local saved approver remarks. The dedicated Comments API is not called.
- Reports → Edit, Preview, and Approvals all use the shared `loadPrintComments(...)` path, while PDF and DOCX already render the comments supplied to the Print Form.

## Changes

1. **Add the settings-driven Comments API call**
   - Resolve the active endpoint by its configured name, with a narrow comments-name fallback.
   - Preserve its configured SAP system, URL/path, GET method, headers, query values, and credentials.
   - Start from the saved request body and replace only the selected eNFA reference dynamically, preserving the configured `comment` wrapper and `Reffld` key casing.

2. **Expose it through an authenticated app endpoint**
   - Validate the signed-in session and selected eNFA number before contacting SAP.
   - Parse normal SAP responses and middleware envelopes safely.
   - Return only normalized Print Form comment data; keep credentials and connection details server-side.

3. **Map and merge comments without hardcoding**
   - Convert non-empty `COMMENT1`–`COMMENT6` values in numeric order into current-version comments.
   - Match each comment to the corresponding saved/API approver level so names remain dynamic when available.
   - Use the Comments API for current remarks, retain numbered history from the saved Preview document, and keep existing local remarks/approver-name behavior as fallbacks when the API is unavailable or returns no comments.

4. **Use the shared result everywhere**
   - Keep Reports → Edit, Preview, Approvals, downloaded PDF, and editable DOCX on the same shared comment loader.
   - Do not change Print Form layout, PDF styling, approval actions, SAP record data, permissions, or other screens.

## Verification

- Add focused tests for nested/stringified SAP responses, `COMMENT1`–`COMMENT6` ordering, blank comment removal, dynamic approver-name pairing, and fallback/merge behavior.
- Verify a configured request sends the selected eNFA dynamically with the saved wrapper/key casing.
- Open Print Form from Reports → Edit and Approvals for the same eNFA and confirm identical comments.
- Download PDF and DOCX and confirm the same comments appear without changing layout or other document details.
- Run focused tests and TypeScript checks.

## Technical scope

- Add one authenticated public server route for Print Form comments.
- Extend `src/lib/sap-report.server.ts`, `src/lib/print-comment-history.ts`, and `src/lib/print-form-data.ts`.
- Update existing shared Print Form callers only where needed to supply their dynamic approver names.
