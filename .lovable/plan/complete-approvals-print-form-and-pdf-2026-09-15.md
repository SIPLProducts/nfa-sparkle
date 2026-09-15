# Complete Approvals Print Form and PDF

## Confirmed issue

The Approvals Print Form currently builds its header and approval chain from the limited worklist row, then loads only Subject, Scope, Budget, Timeline, and Detailed Description from the saved record. When the worklist omits fields such as Company Name, NFA Type, Function, Initiator, or complete approver data, those values appear blank even though the Initiator document has them.

## Changes

1. **Load the complete selected record before opening the Approvals Print Form**
   - Request the existing full SAP record for the selected eNFA number using the logged-in user's existing session and User ID.
   - Continue loading the latest locally saved rich Detailed Description and other saved form values.
   - Use the worklist row only as a fallback when a field is absent from the full record.

2. **Build one complete Approvals document input**
   - Map Company Name, eNFA number, Plant, Date, Initiator, NFA Type, Function, Subject, Scope, Timeline, and Budget from the full saved data.
   - Map every available approval level dynamically, including role, user ID, approver name, status, and action date/time when supplied.
   - Preserve the latest rich content, tables, images, formatting, alignment, and comments already stored for the document.
   - Do not hardcode field values or duplicate data.

3. **Keep the change limited to Approvals**
   - Feed the complete data into the existing read-only Print Form and existing PDF generation.
   - Keep Initiator editing and DOCX behavior unchanged.
   - Do not change SAP payloads, APIs, database structure, approval actions, permissions, attachments, or unrelated screens.
   - Show a clear loading/error state if complete details cannot be loaded, while retaining safe worklist fallbacks.

4. **Verification**
   - Compare the same eNFA in Initiator and Approvals Print Forms field by field.
   - Confirm NFA Type, approval chain, company, all header values, Detailed Description, tables, images, comments, formatting, and alignment match.
   - Download the Approver PDF and confirm the complete document is present across multiple pages without clipping or missing sections.
   - Regression-check Approve, Reject, Back to Initiator, Clarification, attachments, and Initiator DOCX controls remain unchanged.

## Technical scope

The implementation will reuse the existing record-detail endpoint and existing Print Form renderer. The primary change is the data-loading and fallback mapping in the Approvals screen; shared document rendering will only be adjusted if required to display fields already present in the loaded record.
