# Make SAP the single source of truth for NFA business data

## Confirmed current behavior

- Create NFA first inserts the complete record, approvers, attachments, and audit entries into the portal database, then calls SAP. It also saves a second editable copy in `sap_record_draft` and generates a locally stored working document.
- The pictured NFA detail screen first loads the local `nfa` row and only overlays selected SAP values; several fields, status, initiator, description, and attachments can therefore come from local data.
- The legacy change-request screen reads and updates local NFA tables and uses hardcoded NFA Type and Function lists.
- My NFAs, Approvals, and the main Report already load their rows from SAP, but Edit/Print still use local draft fallbacks. Report filters and some display-name fallbacks still use hardcoded master lists.
- SAP attachment display currently persists a ten-minute duplicate response cache in the portal database.

## Changes

1. **Create directly in SAP**
   - Build the request entirely from the form and staged files, including the Detailed Description in SAP `TEXT`.
   - Call the configured Create ENFA endpoint without first inserting an `nfa`, approver, attachment, audit, draft, or working-document row locally.
   - Treat SAP’s response as authoritative: show its exact status/message and returned ENFA number; navigate only after SAP confirms success.
   - If SAP rejects or times out, remain on the completed form with no local NFA created and no misleading “saved locally” message.

2. **Make the NFA detail and change flows SAP-only**
   - Use the ENFA number as the route identifier and fetch the complete record from the configured SAP detail/select endpoint on every open.
   - Render Company, Plant, NFA Type, Function, Subject, impacts, description, initiator, date, status, and approval levels only from SAP response fields—no local merge or fallback.
   - Send edits/resubmissions through the existing configured SAP update/action endpoints, then refetch SAP and display the returned values.
   - If SAP is unavailable, show the SAP error and do not display stale local values.

3. **Remove local/static sources from all NFA screens**
   - Keep My NFAs, Approvals, and Report driven by their existing SAP APIs, while removing `sap_record_draft` and local NFA-table fallbacks from Edit, Print Form, action PDFs, descriptions, comments, initiator names, and previews.
   - Load Company, Plant, NFA Type, and Function options from their configured SAP F4 endpoints wherever selectors or filters need them; remove hardcoded master-data fallbacks and the sample NFA filler.
   - Build downloadable/printable documents on demand from the current SAP response without saving a duplicate working copy locally.

4. **Keep attachments in SAP only**
   - Create and later uploads continue sending Base64 files to the configured SAP endpoints.
   - Lists, previews, and downloads always fetch the current SAP attachment response.
   - Remove writes to local attachment tables/storage and remove both the process-memory and database attachment-response caches, so refresh always reflects SAP.

5. **Preserve unrelated portal functionality**
   - Keep login, users, Custom Roles, screen permissions, SAP API Settings, approval-chain configuration, navigation, and presentation unchanged.
   - Do not delete historical local rows or user data; the application will simply stop using and creating local NFA business copies.
   - Keep local storage only for portal configuration and identity/authorization data, not NFA records or SAP response data.

## Verification

- Create an NFA and confirm one SAP request is made, no local NFA/draft/attachment/document row is added, and SAP’s exact message and ENFA number appear.
- Reopen the returned ENFA, My NFAs, Approvals, Report, Edit, Print Form, and Attached Docs; confirm every business value matches a fresh SAP response.
- Change a value in SAP and refresh the portal; confirm the new value appears with no stale local fallback.
- Simulate an SAP error and confirm the form remains intact, no local record is created, and the SAP error is shown clearly.
- Run existing approval payload, print/PDF, permissions, and navigation tests, then verify desktop and mobile screens.

## Scope assumption

“Local/static storage” means NFA business records and SAP response copies. Portal users, roles, permissions, and SAP connection/endpoint settings remain stored in the portal because they are required to authenticate and securely reach SAP.
