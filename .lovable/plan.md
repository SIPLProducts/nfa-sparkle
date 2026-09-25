# Send the dynamic Print Form PDF with Approve

## Confirmed behavior and payload

- The **Approved Button** already uses the active SAP API Settings row, including its configured URL, `PUT` method, authentication, headers, and middleware routing.
- The current approval request dynamically fills `user_name`, `REFFLD`, and `Comment` but does not send a PDF.
- The supplied updated shape adds `file_path` and `file` inside `approve`; `file` is the Base64 PDF content.
- As confirmed, the app will attach the latest Print Form PDF to **every Approve request**. SAP can retain that file when the request completes the final approval.

## Changes

1. **Create one reusable Print Form PDF exporter**
   - Extract the existing A4 Print Form generation into a shared browser utility that can either download the PDF or return its bytes/Base64.
   - Keep the current logo, header, Detailed Description, approval details, version-wise comments, tables, borders, watermark rules, footer, pagination, spacing, and lossless images unchanged.
   - Keep the existing Print Form → Download PDF action using the same exporter, so manual downloads and approval attachments cannot diverge.

2. **Build the attachment from the latest record data**
   - Before an Approve request, reload the same complete data used by the Approvals Print Form: SAP detail/select/report data, saved rich description, application Initiator, dynamic company logo, dynamic approval flow, and dynamic/saved comments.
   - Include the newly entered approval remark in the generated document data.
   - Render the document in a hidden export-only area, wait for fonts and images, and generate the PDF without opening or changing the visible Print Form.

3. **Send the updated Approve payload**
   - Extend the authenticated approval request with the generated PDF attachment.
   - Build the SAP body from the saved **Approved Button** request template, preserving administrator-added fields and key casing, then dynamically set:
     - `user_name`: logged-in user's configured User ID
     - `REFFLD`: selected eNFA number
     - `Comment`: entered remark
     - `file_path`: dynamic filename such as `ENFA-<number>.pdf`, while preserving any configured path prefix when present
     - `file`: generated Print Form PDF as Base64
   - Do not embed the uploaded sample PDF, sample user, record number, Windows path, comment, URL, or credentials in code.
   - Keep the endpoint URL and HTTP method controlled by SAP API Settings; the existing configured method remains `PUT`.

4. **Preserve workflow and failure behavior**
   - Send approval and PDF together in one SAP request; do not make a second approval call.
   - If PDF generation fails, stop before calling SAP and show a specific error so an approval is never submitted without its required document.
   - Keep SAP response messages, Approve dialog behavior, worklist refresh, Reject, Clarification, Back to Initiator, Preview, Print Form, DOCX, and other workflows unchanged.
   - Validate the generated attachment as a PDF and enforce a safe request-size limit; avoid exposing the Base64 document in diagnostic headers or logs.

## API Settings compatibility

- Add a guarded update for the existing **Approved Button** request template so installations gain empty `file_path` and `file` fields without changing the endpoint path, method, credentials, system selection, or unrelated settings.
- Runtime values always replace the template placeholders; administrators can continue editing the endpoint in SAP API Settings.

## Verification

- Verify the generated attachment begins with a valid PDF signature and matches the visible Print Form layout and data.
- Inspect the outgoing SAP request and confirm the exact five dynamic keys under `approve`, with a nonempty Base64 PDF and record-specific filename.
- Test two different records/users/comments to prove no supplied sample values are hardcoded.
- Confirm successful approval still shows SAP's response and refreshes the worklist.
- Confirm PDF-generation and SAP failures do not double-submit or alter the other approval actions.
- Run the existing Print Form, logo, approval-document, comment-history, and SAP payload checks, plus type checking and a browser approval-flow regression.

## Technical notes

- The existing PDF generator is browser-based (`html2canvas-pro` and `jsPDF`), so the attachment is generated in the signed-in browser and sent through the authenticated approval endpoint.
- The server remains responsible for resolving the logged-in `user_name`, validating the PDF payload, merging runtime values into the configured template, and calling SAP.
