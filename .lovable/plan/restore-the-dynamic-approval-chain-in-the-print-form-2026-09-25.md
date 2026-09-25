# Restore the Dynamic Approval Chain in the Print Form

## Confirmed cause

- The Print Form already renders approval rows without a layout change.
- The configured **Approval flow in Detailed Description** API is active and uses the saved `get_data` payload for Plant, NFA Type, and Function.
- On the Approvals screen, the API call is skipped unless all three values are populated. For the affected record, Function resolves blank, so the Print Form keeps an empty saved chain and shows the warning seen in the screenshot.

## Changes

1. **Resolve the API inputs reliably**
   - Build Plant, NFA Type, and Function from the complete SAP detail, report row, and selected approval row using the existing SAP field aliases.
   - Keep the business mapping dynamic: Plant from the SAP plant field, NFA Type from the SAP NFA type field, and Function from the SAP function field.
   - Do not insert record-specific or fallback business values.

2. **Load the chain before showing the Print Form**
   - Call the configured approval-flow API while preparing the Approvals Print Form.
   - Parse `DESIG1…DESIG7` and `USERID1…USERID7`, then merge them level-by-level with any saved names, statuses, dates, and times.
   - Pass the completed chain into the existing Print Form so the preview, Download PDF, Print, and final-approval PDF use the same data.
   - Prevent the dialog’s secondary request from clearing a valid chain when an optional source field is absent or the API returns an error.

3. **Keep behavior isolated**
   - Do not change the Print Form layout, styling, comments, logo, Detailed Description, approval actions, or other screens.
   - Keep SAP endpoint URL, method, credentials, headers, and request template controlled by SAP API Settings.

## Verification

- Add focused coverage for SAP response envelopes and all seven approval levels.
- Verify the affected Approvals record displays the dynamic Approval Chain and no longer reports Function/Approval Chain as unavailable when SAP supplies them.
- Confirm the downloaded and final-approval PDFs contain the same chain as the on-screen Print Form.
- Check the current build and relevant tests without changing unrelated functionality.
