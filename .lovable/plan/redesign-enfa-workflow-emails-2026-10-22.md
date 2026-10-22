# Redesign ENFA workflow emails

## What changes (look only)
All five emails share one template: Approve, Final Approval, Reject, Back to Initiator and Clarification. The redesign covers all of them.
- **Header:** the portal's corporate blue band with a thin colour strip that matches the action. Green means approved, red means rejected, amber means sent back and blue means clarification. "eNFA Portal" sits small above a larger action title.
- **Status badge:** a rounded pill under the greeting with the action name in the same colour.
- **Typography:** a clean sans-serif. The title is larger and bold, body text is easier to read, and the details have more space between lines.
- **Details card:** ENFA No, Subject, Action, Action By, Level, Comment and Action Date stay. Labels are small grey capitals, values are dark, and soft dividers sit between rows. The Comment shows in a lightly shaded quote box.
- **Signature:** "Regards," then the sender name in bold, with "eNFA Workflow Notification" under it and a coloured accent line on the left.
- **Footer:** a light grey band with "This is an automated notification. Please do not reply." and the © line.
- Works in Outlook and Gmail (table layout with inline styles) and on phones (full width below 640px).

## Unchanged
Wording, recipients, subject line, plain-text copy, when emails are sent, the SAP calls and Email Configuration all stay as they are.

## Technical
- Only `renderWorkflowMailHtml` in `src/lib/workflow-mail.server.ts` changes. A per-action accent colour map is added.
- Existing tests are updated only where they check the HTML markup, then run.
