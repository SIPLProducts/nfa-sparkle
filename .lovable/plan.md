# Show created NFA details and uploaded files

## Goal
Simplify the Note for Approval details page so it displays the created NFA information shown in the second screenshot plus its uploaded files, populated dynamically without hardcoded values.

## Changes
- Keep the existing Back control, dynamic eNFA number, current status, and Note for Approval details panel.
- Load the selected created NFA by its dynamic eNFA number through the existing authenticated SAP Select/Detail API flow.
- Map the returned Company, Plant, NFA Type, Function, Subject, Scope Impact, Budget, Timeline, Initiator, Created date, and Detailed Description into the existing read-only field layout without hardcoded values.
- Preserve the saved rich Detailed Description and initiator as fallbacks for values intentionally maintained by the portal rather than SAP.
- Keep the Supporting Documents section so existing uploaded files remain visible, and retain the current upload control whenever the NFA status permits uploads.
- Remove the Formatted document control, Approval Chain, Approvals Timeline, Approval Activity Timeline, and resubmit panel from this details page.
- Remove page-only loading, filtering, and action code that becomes unused; do not alter SAP settings, stored records, approval logic, or the separate Approvals, Reports, Edit, and Print Form screens.

## Verification
- Open a newly created NFA and confirm only the header/status, fields shown in the second screenshot, and uploaded files section are visible.
- Confirm every displayed value matches the selected NFA’s live API response or its saved portal-only detail, including the SAP-returned eNFA number.
- Confirm uploaded files can still be viewed and new files can still be added when permitted.
- Confirm none of the other removed sections appear and no literal company, plant, type, function, user, date, or NFA number is introduced.
- Verify the page at desktop and mobile sizes, then run focused checks and confirm the preview reports no errors.
