# Fix Initiator name and Detailed Description in the downloaded PDF

## Confirmed causes

**Initiator blank (e.g. NFA 100208)**
- The Print Form looks up the Initiator only from the portal's own NFA record or an uploaded working document for that eNFA number.
- NFAs are now created directly in SAP, so the portal has no NFA record and no working document for 100208 (checked: 0 rows each; only the saved Detailed Description exists). The lookup finds nobody and the field stays empty, on screen and in the PDF.

**PDF Detailed Description differs from the web form**
- The PDF builder splits the Detailed Description into one separate bordered box per paragraph, table and image so it can break pages. Every box draws its own top and bottom border, which produces the stray horizontal lines (e.g. between "hi" and the text below it).
- Each page is then shrunk to fit A4, so the table text and the image come out smaller than on the web form.

## Changes

1. **Initiator**
   - Keep the current order: portal NFA record, then working document.
   - When neither exists, use the initiator User ID that SAP already returns for the record (the same read the Print Form already performs for approvers) and show that user's portal profile name; if no matching portal user exists, show the SAP initiator name/ID as returned.
   - Applies to Print Form, Preview (X), Approvals and the downloaded PDF, since they share one preparation step.
2. **PDF Detailed Description**
   - Draw the Detailed Description as one continuous bordered section: only side borders on inner pieces, a top border on the first piece and a bottom border on the last piece of each page. No lines between paragraphs, tables or images.
   - Lay pages out at the web form's width so table font size, column widths, cell borders, bold text, alignment and image size match the web view; only break pages between pieces (tables/rows and images are never cut).
   - Watermark, frame, footer, header, approver grid and comments stay as they are.

## Not changed
SAP APIs and payloads, approval workflow, emails, Preview SAP-PDF branch, DOCX, editing, permissions.

## Verification
- Open 100208 Print Form signed in: Initiator shows the creator's name.
- Download PDF; render pages and compare with the web form: no stray lines, same table/image sizes and formatting, clean page breaks on a long description.
- Add tests: initiator fallback order (portal record, working document, SAP user ID); PDF blocks produce no inner borders. Run existing Print Form tests.

## Technical details
- `src/lib/print-initiator.functions.ts` / `prepare-web-print-form.ts`: fallback to `INIT_USERID` (from `getInitiatorRecordDetail`/select detail) resolved via `profiles.username`, else `INIT_NAME`.
- `src/lib/print-form-pdf.ts`: `contentTable` marks first/middle/last pieces with classes; `src/styles.css` `.enfa-pdf-export` rules remove inner top/bottom borders and fix staging width to the on-screen sheet width.
