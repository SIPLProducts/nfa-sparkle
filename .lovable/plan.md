# Dynamic Print Form watermark

## Requested result
- Display **DRAFT** on the Print Form while approval is in progress.
- Display **APPROVED** once the complete approval process is finished, preserving the existing successful APPROVED behavior.
- Use the selected record’s current approval status, without hardcoded record values or changes to other workflows.

## Confirmed current behavior
- The PDF generator already chooses DRAFT for non-final statuses and APPROVED for recognized final statuses.
- The displayed Print Form does not currently render a watermark; its status is passed separately to PDF export.
- The web Preview download does not currently pass the record’s status to the PDF generator.

## Changes
1. Trace the selected record’s overall status and ordered approval levels through each application-generated Print Form. Confirm which existing status values represent full completion; an individual approver’s approval must not be treated as final completion.
2. Reuse a single status-to-watermark decision for the displayed form, browser printing, and downloaded PDF. Show DRAFT for in-progress or unconfirmed completion; preserve APPROVED for confirmed final approval.
3. Pass the current status through the shared Print Form preparation and the web Preview branch. Recompute the watermark whenever the supplied record status changes, including reopening the form after an approval and switching records.
4. Add a subtle diagonal watermark without shifting the form, covering its controls, blocking description editing, or reducing readability. Keep the existing PDF watermark placement and ensure exported pages do not receive duplicate watermarks.

## Scope protection
- No changes to approval actions, SAP request payloads, permissions, saved business data, approval chains, comments, or existing form layout.
- SAP-supplied PDF previews remain unchanged; the portal will not rewrite SAP documents or add a second watermark to them.
- No new polling or automatic workflow transitions.

## Verification
- Check an in-progress record, a partially approved chain, and a fully completed record.
- Confirm on-screen and downloaded labels agree, with one watermark per PDF page.
- Check browser printing, editable description controls, close/reopen, and switching between records.
- Run focused status/export tests and check compilation. Report separately if a live SAP record is unavailable for verification.

## Technical details
- Reuse or extract the existing `printFormStatusLabel` rule into a browser-safe shared helper.
- Update `EnfaDocument`, `PrintFormDialog`, status preparation, and the application-generated branch of `RecordPreviewDialog` as needed.
- Preserve the PDF generator’s existing final-approval behavior and workflow attachment handling.