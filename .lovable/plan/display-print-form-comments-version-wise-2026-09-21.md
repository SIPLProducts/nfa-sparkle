# Display Print Form Comments Version-wise

## Confirmed cause

- The reference PDF for eNFA 100068 contains **Current Version Comments**, followed by **Version 8 Comments** down through **Version 0 Comments**.
- The existing Print Form renderer already understands version-tagged comments and can display separate version blocks.
- The shared comment loader currently reads only the latest `nfa_approver` rows and returns every comment without a version. Therefore, all available comments are flattened into one Current Version block.
- SAP-only records such as 100068 and 100122 have no matching local `nfa` / `nfa_approver` history. Their complete version history is available through the already configured SAP Preview document, so the fix must use that saved source rather than inventing or hardcoding versions.

## Changes

1. **Load the complete saved comment history**
   - Extend the shared Print Form comment loader to retrieve the selected eNFA’s configured SAP Preview document and extract its existing Current Version and numbered Version comment sections.
   - Preserve each section’s saved approver names, remarks, numeric version, and display order.
   - Keep local current comments and local audit history as fallbacks for locally stored records.
   - If no saved remarks/history exists, retain the existing approver-name fallback for Current Version Comments.

2. **Normalize version groups once**
   - Add a focused parser/normalizer that converts saved comment history into the existing `{ name, text, version }` document format.
   - Represent the unnumbered current block as newer than the highest saved numbered version, while retaining numbered versions including Version 0.
   - Ignore document headers, page footers, and unrelated PDF text so only comment entries reach the Print Form.

3. **Use the same versioned data everywhere**
   - Keep Reports → Edit, Approvals, Create/Preview, and downloaded PDFs on the same shared loader so their comments match.
   - Update editable DOCX generation to print the same headings and grouping instead of flattening all comments into one section.
   - Leave header details, Detailed Description, approvals, company logo, images, tables, workflows, SAP action payloads, permissions, and all other screens unchanged.

## Verification

- Verify eNFA 100068 displays Current Version followed by Versions 8–0 exactly in descending order.
- Verify names and remarks come from saved data, with no hardcoded record, user, comment, or version values.
- Compare Reports → Edit and Approvals for the same eNFA and confirm identical comment sections.
- Download the generated PDF and DOCX and confirm all version sections are present, ordered correctly, and not clipped or split incorrectly.
- Test records with only current comments, local audit history, no comments, Version 0, and an unavailable SAP Preview source.
- Run the focused document/comment tests and TypeScript checks.

## Technical scope

- Primary files: `src/lib/print-form-data.ts`, a small comment-history parser/helper, and `src/lib/enfa-docx.functions.ts`.
- Existing `EnfaDocument` version grouping remains the shared on-screen/PDF renderer, with only a small correction if needed for deterministic current-versus-numbered ordering.
- No database schema change and no SAP configuration or workflow change.
