# Dynamic company logo in Print Form

## Goal
Use the selected or saved Company Code to obtain the company logo from the configured SAP API and render the same logo in the on-screen Print Form, approver PDF, and initiator DOCX, without changing existing workflow behavior.

## Confirmed current state
- SAP API Settings already contains an active endpoint named **Logo in Detailed Description** with the supplied approval URL, GET method, Basic authentication, and `{ "logo": { "cc_code": "9000" } }` request template.
- The shared Print Form currently displays the fixed `/ramky-logo.png` image.
- DOCX generation separately fetches that same fixed image.
- The shared document data currently carries Company Name but not Company Code.

## Implementation
1. **Connect the configured logo endpoint**
   - Add a server-side SAP logo caller that resolves **Logo in Detailed Description** from API Settings by name.
   - Reuse its selected SAP system, URL, authentication, headers, query values, and request template.
   - Replace only `logo.cc_code` with the current record’s Company Code.
   - Support the supplied JSON-string Base64 response and return a validated image result with clear JSON errors.
   - Allow a sufficiently large response size for logo image data and preserve the configured HTTP method.

2. **Expose an authenticated app endpoint**
   - Add a small authenticated request endpoint accepting only a bounded Company Code.
   - Return the decoded logo in a browser-safe form without exposing SAP credentials or configuration.
   - Do not cache one company’s logo as another company’s logo.

3. **Carry Company Code through the document model**
   - Add `companyCode` to the shared Print Form data contract.
   - Create NFA: use the currently selected Company Code.
   - Edit and Approvals: resolve Company Code dynamically from existing SAP detail/select/worklist aliases and existing plant/company mapping only when necessary.
   - Keep Company Name and all existing document fields unchanged.

4. **Render one dynamic logo everywhere**
   - Load the logo when the Print Form opens or its Company Code changes.
   - Pass the returned logo to the shared document renderer instead of `/ramky-logo.png`.
   - Reuse the exact same fetched image for PDF capture and DOCX generation, converting SAP’s BMP response to PNG when DOCX compatibility requires it.
   - Show an empty logo area and a non-blocking message if SAP cannot supply a logo; do not substitute a hardcoded company logo.

5. **Focused verification**
   - Add tests for nested/stringified Base64 responses, Company Code substitution, invalid/empty logo responses, and Company Code resolution in Approvals.
   - Verify Create, Edit, and Approvals Print Forms all request the logo for their own Company Code.
   - Verify PDF and DOCX use the same dynamic logo while all existing details, tables, images, comments, and approval-chain content remain unchanged.

## Scope protection
- No SAP workflow, approval action, DMS, attachment, rich-text, or layout changes.
- No hardcoded company-to-logo mapping.
- No changes to existing endpoint credentials or SAP system settings.
