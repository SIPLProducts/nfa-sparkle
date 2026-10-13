# Show the complete web Print Form in Preview

## What is confirmed
- The PDF you downloaded from this same Preview (ENFA-100172.pdf) contains the complete form: header fields, Detailed Description ("Hi sir Good afternoon"), the approver grid (MANAGER 9001, SCM HEAD 9002, PLANT HEAD 9003) and Current Version Comments.
- So the data is loaded correctly. The problem is only how the form is shown on screen.
- Root cause: in Preview, the form sits inside its own small scroll box limited to 70% of the screen height, and that box sits inside the Preview window, which scrolls too. On your screen (about 595 px tall) the box ends right after the Detailed Description. The approver grid and comments are hidden below it behind a second, easy-to-miss scroll area.

## Changes
1. Remove the inner height limit on the web Print Form in Preview. The whole form then flows in the Preview window's single scroll area, like other dialogs, with the title and buttons still reachable.
2. Keep the SAP PDF view (when SAP returns a Base64 PDF) exactly as it is.
3. Keep Download and Print unchanged. They already produce the full form, and printing already removes height limits.

## Not changed
Data loading, the X/PDF decision, the standalone Print Form button, Edit, approvals, attachments, permissions and other screens.

## Verification
- Signed-in Preview at your screen size (989 × 595) with a controlled X reply. Confirm that scrolling the Preview shows the header, Detailed Description, approver grid and comments, and that Close stays reachable.
- Confirm Download still produces the same complete PDF and the SAP PDF branch still renders.

## Technical details
- `src/components/report/RecordPreviewDialog.tsx`: drop `max-h-[70vh] overflow-y-auto` from the `descriptionRef` wrapper (`enfa-print-area`). `DialogContent` keeps `max-h-[92vh] overflow-y-auto` as the single scroll container. The PDF canvas container is untouched.
