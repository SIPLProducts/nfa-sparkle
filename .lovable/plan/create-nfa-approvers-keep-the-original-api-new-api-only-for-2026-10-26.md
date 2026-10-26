# Create NFA approvers: keep the original API, new API only for Preview

## What I checked
- The Create NFA Approvers window still calls its original API, **"Approvals In create"** (`get_detail` with check, plant, nfa_type, funct). The last change didn't touch its code, payload or lookup.
- The new **"Approval flow in Detailed Description"** request with `enfa_no` is used only by Preview, the Approvals PDFs and the print forms. Your second screenshot shows it working: 9001, 9002 and 9003 appear in the Print Form.
- "Failed to fetch" is a browser message. It means the browser got no reply from the portal at all, not an error from SAP. Likely causes are the web process restarting while the new website was being copied in, or the request being cut off while it waited on SAP. This isn't confirmed yet.

## Steps
1. Reproduce: call the Create approvers request for Plant 9000 / IT ITEMS / PROJECTS in both modes and record the server log for that call.
2. If the server returns an error or crashes, fix only that cause and leave the Create payload and logic as they are.
3. Guarantee the separation in code. The Create window may never call the "Approval flow in Detailed Description" entry, and the Preview/Print Form may never call "Approvals In create". Add a test for each so this can't change again.
4. In the Approvers window, replace "Failed to fetch" with "Could not reach the portal, please try again" and add a Retry link. The request and payload stay the same.

## Not changed
The Create NFA payload, the Predefined/Dynamic rules, the minimum of 2 approvers, Preview's new `enfa_no` logic, emails and all other screens.

## After deploying
Copy in the whole new website, restart the web process, then reopen Create NFA. If the message still appears, send me the server log lines from that moment.
