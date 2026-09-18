# Make the Approvals Print Form match Edit and the reference document

## Confirmed cause

- Edit and Approvals already render through the same `PrintFormDialog` and `EnfaDocument`, so the document layout is not the source of the missing fields.
- Edit renders from its loaded full record, selected row, saved rich description, approval levels, and saved comments.
- Approvals separately reconstructs those values and currently opens the Print Form before its full-record, draft, and comment requests finish. If the approval row is partial or the SAP detail request is unavailable, the document can remain without header fields, approval-chain values, or comments.
- The saved data for eNFA 100122 contains Subject, Scope Impact, Budget Impact, Timeline Impact, and the rich Detailed Description with its table. There is no matching local NFA row, so its comments must use the existing Edit-compatible fallback from the resolved approver names.
- The supplied DOCX confirms the expected content and ordering: complete header, rich Detailed Description, approval grid, and comments.

## Changes

1. **Use the same complete record source as Edit**
   - Load the selected record through the existing Edit detail flow, using the existing authenticated request and logged-in SAP user ID.
   - Keep the current approval-detail request and selected worklist row as fallbacks when a source is unavailable or incomplete.
   - Normalize nested SAP response wrappers and field names before resolving document values.

2. **Build one complete Approvals document before showing it**
   - Resolve Company Name, NFA number, Plant, Date, Initiator, NFA Type, Function, Subject, Scope, Timeline, Budget, and Detailed Description field-by-field.
   - Use nonblank values only, with precedence matching Edit: complete SAP detail, existing saved draft where applicable, then the selected approval row.
   - Preserve the saved rich HTML unchanged so text formatting, alignment, tables, and embedded images reach the shared renderer and PDF.
   - Show the loading state until all available sources have settled, preventing a partial or blank document from appearing first.

3. **Resolve the full Approval Chain and Comments**
   - Merge levels 1–6 dynamically from the complete record and approval worklist, including role, user ID, approver name, status, action date, and action time.
   - Resolve each field independently so a blank value from one source cannot erase a populated value from another.
   - Continue loading existing saved remarks. When none exist, use the shared Edit behavior that lists the resolved approver names under Current Version Comments.

4. **Keep the change isolated**
   - Change only the Approvals Print Form data-loading and mapping path.
   - Keep the shared layout, Edit screen, DOCX behavior, PDF controls, SAP payloads, approval actions, attachments, permissions, and other screens unchanged.
   - Do not hardcode record numbers, company values, approvers, comments, or document content.

## Verification

- Compare eNFA 100122 in Edit and Approvals against the supplied DOCX for every header field, rich text, table, image, approval cell, user ID, and comment entry.
- Download the Approver PDF and confirm the complete document appears across all pages without blank app/sidebar content, clipping, or missing sections.
- Check a record with saved remarks and one relying on approver-name fallback comments.
- Regression-check Preview, Attached Docs, Approve, Reject, Back to Initiator, and Clarification.

## Technical scope

The functional change remains in `src/routes/_authed.approvals.tsx`. Existing `PrintFormDialog`, `EnfaDocument`, document generation, APIs, and database structure remain unchanged.
