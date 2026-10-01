# Show the SAP-returned eNFA number

## Goal
Display only the eNFA number returned by the successful Create NFA API response on the Note for Approval page, without changing its layout or workflow.

## Changes
- Keep the record editable until the successful SAP response number has been saved.
- Check that saving the returned number succeeds instead of silently continuing with the temporary local number.
- Move the existing in-process transition immediately after the SAP submission step, preserving the current approval state, messages, navigation, attachments, document creation, and failure behavior.
- Add a focused regression test for extracting and persisting the dynamic response number if the existing test structure supports this flow.

## Verification
- Confirm a successful response such as `ENFA_NO: 100134` results in the Note for Approval badge showing `100134`, not the earlier locally generated number.
- Confirm no hardcoded eNFA number is introduced and existing submission behavior remains unchanged.
- Run focused tests and verify the preview build reports no errors.
