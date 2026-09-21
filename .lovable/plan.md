# Display the Application Creator as Print Form Initiator

## Confirmed issue

The application saves the creator on each local NFA record through its `initiator_id`, linked to the user profile. However, the persisted Print Form paths currently populate Initiator from SAP response fields such as `INIT_NAME`; when SAP does not provide that value, the Print Form is blank. The existing local NFA detail page already resolves the initiator from `initiator_id` and displays the creator's profile name.

## Changes

1. **Resolve the Initiator from application data**
   - Add one reusable lookup that finds the local NFA by eNFA number, reads its saved `initiator_id`, and resolves that user's existing profile display name.
   - Use the profile's full name as the displayed Initiator, following the existing local NFA detail behavior.
   - Do not read or fall back to SAP Initiator fields, and do not hardcode any user value.

2. **Use the same Initiator in every Print Form path**
   - Apply the application-resolved creator to the formatted Preview, Reports/Edit Print Form, and Approvals Print Form.
   - Ensure the same value flows into downloaded Approver PDFs and Initiator DOCX files generated from those Print Forms.
   - For a new, unsaved NFA, continue using the current signed-in application user as its creator, but prefer that user's profile name rather than an SAP value.

3. **Handle unavailable local creator data safely**
   - Keep the field blank when no matching local NFA or creator profile exists rather than substituting SAP or an unrelated editor.
   - Do not treat `sap_record_draft.updated_by` as the creator because later edits can change it.
   - Leave all SAP requests, approval logic, comments, document layout, attachments, and other fields unchanged.

4. **Verification**
   - Add focused tests for creator-name resolution, including records with and without matching local creator data.
   - Verify the same NFA shows the same application creator in Preview, Edit Print Form, Approvals Print Form, and downloaded PDF.
   - Confirm no SAP Initiator value is used and existing approval details, comments, formatting, and actions remain unchanged.

## Technical scope

The change will reuse the existing `nfa.initiator_id` relationship and the existing safe profile-name lookup. Only Print Form data preparation and its callers will change; no database schema, SAP endpoint, payload, or workflow change is required.
