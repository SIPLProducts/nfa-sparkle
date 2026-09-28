# Integrate the dynamic Reject PDF payload

Update the existing Reject action to send the five-field SAP payload from the supplied example, with every value resolved at runtime and no UI changes.

## Reject request

- Keep using the existing active **Reject Button** configuration, including its PUT method, SAP system, URL, credentials, headers, and query settings.
- Send this shape when Reject/Cancel is confirmed:
  ```json
  {
    "reject": {
      "user_name": "<logged-in user's User ID>",
      "REFFLD": "<selected eNFA number>",
      "Comment": "<entered remarks>",
      "file_path": "<generated Print Form PDF filename>",
      "file": "<generated Print Form PDF as Base64>"
    }
  }
  ```
- Generate the PDF from the latest selected record data, saved rich description, dynamic company logo, approval chain, and version-wise comments already used by the Print Form.
- Add the rejection comment to the generated document before creating the PDF, matching the existing final-approval PDF preparation.
- Preserve the saved template’s wrapper/key casing and any configured directory prefix for `file_path`; only the filename and other dynamic values are replaced.
- Continue showing SAP’s response through the existing success/error messages and refresh the worklist only after success.

## Configuration cleanup

- Replace the current **Reject Button** body template—which contains sample user, eNFA, path, comment, and a large pasted PDF—with clean empty placeholders for the five fields.
- Apply the cleanup through an idempotent migration so hosted and Quality deployments receive the same valid template without changing any other endpoint setting.

## Technical changes

- Extend the shared approval-action payload builder so `file_path` and `file` are supported for Reject as well as Approve, while other actions remain unchanged.
- Reuse the existing Print Form PDF generator in the Reject submission path; Approve retains its current final-level-only PDF behavior.
- Keep the proxy’s existing PDF validation, authenticated dynamic `user_name`, safe request inspection, and SAP error handling.
- Add focused tests for Reject payload construction, configured path-prefix preservation, and ensuring Clarification/Back to Initiator never receive file fields.
- Verify the Reject request contains a valid `%PDF-` Base64 attachment and all five dynamic fields, then confirm the existing Approve and other action tests still pass.

## Unchanged

- No buttons, dialogs, labels, layout, styling, approval-level rules, or other workflows change.
