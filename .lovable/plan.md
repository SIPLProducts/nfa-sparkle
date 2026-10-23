# Make the web Print Form match the SAP Preview layout

## Goal
When SAP replies `X`, Preview shows the web Print Form. That form, and the Print Form button's form, should both look like the SAP Preview in your first screenshot, with the same data in both.

## Target design (from the SAP Preview)
- Outer border with the company name centred and the logo on the right.
- Grey "NOTE FOR APPROVAL" band.
- Serif text for the fields: NFA No / Plant name (no plant code), Date on the right, Initiator, NFA Type, Function, Sub, Scope Impact, Timeline Impact, Budget Impact with "Rs.1.00 (Lakhs)".
- NFA Type and Function shown as in SAP ("It Items", "Projects").
- Detailed Description box under the fields.
- Approver grid with three equal columns and tall boxes. Each box shows "Role:" and "User id:", and empty rows fill out the grid.
- A "Comments:" section listing the comments, followed by blank space to the bottom border.
- A large grey diagonal DRAFT/APPROVED watermark.

## Changes
1. Restyle the shared form layout so it matches the target above. The Print Form button, Preview `X`, Print and Download PDF all use this one layout, so they always match.
2. Show the Detailed Description as formatted text. Never show raw tags such as `<p>Hi </p>`.
3. Make both views load the same record data. Preview `X` uses the Print Form's approval-chain refresh and clean-up, so the approvers, function and comments are identical.
4. Give Preview one scroll area, the same as Print Form.

## Not changed
- When SAP sends a PDF, Preview still shows it unchanged, with Open in new tab, Download and Print.
- Print Form editing, DOCX, approvals, emails, attachments, permissions and every SAP request.

## Verification
- Signed in, open the same record from Print Form and from Preview with a controlled `X` reply. Compare screenshots with your first image at your screen size.
- Download both PDFs and confirm they match.
- Run the existing Print Form and Preview tests.
- For 100183: if SAP sends a PDF for it, Preview keeps showing SAP's own PDF, which already looks like the target.

## Technical details
- `EnfaDocument.tsx` + PDF/print rules in `src/styles.css`: serif field font, a fixed 3-column grid with a minimum height and filler rows, a "Comments:" block, and the watermark style.
- New `PrintFormSheet.tsx` covers normalise, flow refresh, logo and watermark. It is used by `PrintFormDialog` and by the `X` branch of `RecordPreviewDialog`. The inner `max-h-[70vh]` scroll is removed.
