# Match X Preview to the complete existing Print Form

## Confirmed comparison
- Both views render `EnfaDocument`, so the main form layout is already shared.
- The existing Approvals Print Form additionally reads the record-specific Report row, saved rich Detailed Description, SAP comments/history, and resolved approval flow. Preview's loader currently reads only Select/Detail and saved approval context.
- `EnfaDocument` omits the entire approval grid and comments section when their supplied lists are empty. The incomplete Preview preparation can therefore remove sections rather than merely show blank values.
- Print Form also loads the company logo dynamically; Preview currently bypasses that preparation and uses a narrower dialog.

These differences are confirmed in source. The precise SAP data available for eNFA 100172 still needs a live comparison; the previous scrolling diagnosis is not established as the cause.

## Changes
1. Share the existing complete, read-only Print Form preparation between Approvals Print Form and the Preview X branch: current SAP details, record-specific Report data, saved rich description, ordered approval levels, comments and version history, and existing fallbacks.
2. Preserve separate Edit and Select sources during merging so an empty field from one response cannot overwrite a populated field from the other.
3. Render X Preview with the same existing form layout, company-logo preparation, document width, and dynamic watermark. Preserve Preview's current actions and ensure the entire form remains reachable by scrolling.
4. Keep SAP PDF Preview, response classification, Edit/Save, approval actions, workflow PDF attachments, permissions, and stored data unchanged. Do not invent missing values or treat errors as X.

## Technical details
- Extract the existing Approvals display preparation into a focused shared client-side loader and reuse it from `loadWebPreviewForm`; retain screen-specific permission checks and cancellation handling.
- Reuse the existing approval-flow and complete-comment merge helpers instead of introducing alternate mapping rules.
- Share only the read-only document presentation and optional logo preparation; do not nest another dialog or expose editing controls in Preview.
- No database migration or SAP configuration changes are planned.

## Verification
- Add regression tests for X and padded/encoded X, sparse SAP replies, populated fallback fields, rich Detailed Description, all returned approval levels, and current/historical comments.
- Compare Print Form and X Preview for the same record: field values, description formatting/images, logo, approval grid, comments, watermark, and document width.
- Verify scrolling, Print, and downloaded web PDF retain the complete form; verify SAP PDF and invalid-response branches remain unchanged.
- Test with a signed-in real record if the SAP service is reachable. If the company service is unavailable, report that limitation explicitly rather than claiming live parity.