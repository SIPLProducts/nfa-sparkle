# Fix Preview: SAP "X" → web Print Form with Detailed Description

## What is confirmed
- SAP returns `"X"` (3 bytes) and our server already turns it into `{"source":"web"}` (your screenshot of eNFA 100172).
- After that, the browser loads the web Print Form by calling the record Select and Detail services, plus saved data. So the failure is after SAP's reply, in loading or showing the web form. The exact step is not yet confirmed.
- A reply of `X&#x20;` (X plus an encoded space) is currently rejected as "unexpected response". It should be treated as `X`.

## Changes
1. **Recognise every form of X:** accept `X`, `"X"`, `X ` and `X&#x20;` (and other encoded spaces), raw or wrapped in a body. Anything else that is not a valid PDF still shows a clear error and never falls back silently.
2. **Find and fix the web-form failure:** reproduce Preview for a record that returns X, signed in, and capture what the Select/Detail calls return and what the dialog shows. Then fix the actual cause (for example a rejected request, a reply the reader doesn't recognise, or a step that stops the form when one source fails).
3. **Always show the Detailed Description:** take it from SAP's `TEXT`/Detailed Description when present, otherwise from the saved record, so it is never blank when it exists anywhere. Use the same layout as the existing Print Form.
4. **PDF branch unchanged:** a valid Base64 PDF still opens the SAP Print Form with Open, Download and Print.
5. Keep switching records safe: clear the old preview and ignore late replies.

## Not changed
Print Form button, Edit, approvals, attachments, permissions and other screens.

## Verification
- Tests for `X`, `"X"`, `X&#x20;`, wrapped X, a valid PDF and invalid replies.
- Signed-in Preview test in Reports, My NFAs and Approvals using a controlled X reply. Confirm the web form shows details, approval chain, comments and the Detailed Description.
- A live SAP check needs the company server. Deploy the full build and restart only the web app.

## Technical details
- `src/lib/preview-response.ts`: decode HTML entities and trim whitespace before the X check; extend `preview-response.test.ts`.
- `src/lib/web-preview-form.ts` / `RecordPreviewDialog.tsx`: diagnose the web branch and make Select/Detail failures non-blocking. Description priority: SAP TEXT → saved draft `detailed_description`.
- `src/lib/approval-print-document.ts`: only the description fallback order, if diagnosis shows it is needed.
