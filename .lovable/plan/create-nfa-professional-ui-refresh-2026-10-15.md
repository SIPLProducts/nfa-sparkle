# Create NFA — professional UI refresh

## Design direction
Use the portal’s existing corporate blue, white surfaces, muted backgrounds, and current fonts. Match the cleaner Approvals styling without changing other screens or the shared navigation.

## Layout and spacing
- Keep the current field order: **Company → Plant → NFA Type → Function**, followed by Note Details and Detailed Description.
- Retain a wider main column and a supporting right column on sufficiently wide screens. Keep **Approvers directly below Document Attachments** in the right column.
- Stack the sections on smaller screens; choose breakpoints that leave fields and approver details comfortably readable when the sidebar is visible.
- Replace heavy boxed section styling with clean section headings, subtle dividers, and consistent spacing. Keep all content visible rather than introducing tabs or a multi-step form that hides fields.
- Keep Submit as the only header action; improve its alignment and touch target without adding Save, Print Form, or Load Sample.

## Fields and editor
- Use clearer label hierarchy, consistent control heights, aligned required markers, and balanced gaps between fields.
- Preserve every existing label, value, placeholder, dropdown option, loading/error message, Retry action, and disabled state.
- Give Detailed Description a clean, full-width editing area with better spacing around its existing toolbar and Expand editor action.
- Keep every formatting tool and the expanded editor’s shared description value. Make the expanded dialog fit smaller screens and scroll without clipping its controls.

## Attachments and approvers
- Refine the upload area's appearance and file-list alignment. Keep file selection, limits, removal, and busy states unchanged; do not add new upload behavior.
- Style approver rows with clearer column headings, consistent spacing, and a subtle selected-row tint.
- Retain checkboxes, all current columns, dynamic email values, and the selected sequence in its existing order.
- Keep horizontal scrolling local to the approver table when needed; prevent page-wide overflow and clipped email addresses.

## Technical scope
- Presentation-only changes in `src/routes/_authed.nfa.new.tsx` and `src/components/nfa/ApproverSelector.tsx`.
- Reuse existing semantic theme tokens and UI controls. Scope editor styling through the Create screen rather than changing its shared behavior or other screens.
- Leave state, effects, validation, API requests, submission handlers, permissions, saved data, and SAP payloads untouched.
- Approver selection remains UI-only, exactly as it is now; this redesign does not connect it to workflow routing.

## Verification
- Check the resulting preview for errors.
- Review wide, intermediate, and phone-sized layouts for alignment, readable labels, and overflow.
- Exercise dropdown selection, rich-text formatting and expansion, attachment addition/removal, and approver selection; confirm existing behavior is retained.
- Check that Submit keeps its existing handler and disabled behavior without creating a test NFA solely to verify styling.
