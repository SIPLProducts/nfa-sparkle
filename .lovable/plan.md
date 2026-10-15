# Redesign the Create NFA screen (look only)

## What you will see
- **Header:** a progress strip under the title showing the three steps (Organisation, Note Details, Attachments & Approvers) with a tick as required fields fill in; Submit stays top-right, larger and full-width on phones.
- **Cards:** softer rounded corners, a numbered badge (1, 2, 3, 4) beside each card title, a thin blue top accent, cleaner white headers and more breathing room inside.
- **Form fields:** labels in sentence case (not all caps), taller fields with a clear blue focus outline, red asterisk for required fields, helper/retry text aligned under each field.
- **Upload box:** larger drop area with a round icon, blue highlight when pointing at it; staged files shown as tidy rows with a file icon and size.
- **Approvers:** table headers lighter, rows highlight on point, selected sequence shown as numbered blue chips.
- **Right column** stays visible while scrolling on wide screens; on tablets/phones everything stacks into one clean column.

## Not changed
All fields, dropdown loading, Submit, uploads, approver selection, validation and every SAP call stay exactly as now.

## Technical details
- Edit only presentation classes in `src/routes/_authed.nfa.new.tsx` (`PageHeader` actions, `Section`, `Field`, upload markup, grid gaps, `lg:sticky` right column) and `src/components/nfa/ApproverSelector.tsx` table/chip styling.
- Progress strip derives completion from existing state values (read-only); no new state or logic.
- Use existing theme tokens only; replace hardcoded `rose-*` with `destructive` token.
- Verify with build and a browser screenshot at desktop and phone widths.
