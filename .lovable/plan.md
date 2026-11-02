# Create User window: original layout, polished

## What changes
- Remove the four section groups (Account, Personal details, Organisation, Security) and return to the original single form with the same field order as before.
- Keep a clean two-column grid on wider screens, one column on phones.
- Polish only the look:
  - Header: clear title with a short subtitle and a thin divider.
  - Consistent label style (small, medium weight), uniform field height and gap between fields.
  - Required fields keep their red asterisk; error messages sit neatly under each field.
  - Password fields keep the show/hide eye, aligned inside the box.
  - Footer with a divider, Cancel and Create user aligned right; full-width stacked buttons on phones; footer stays visible while the form scrolls.

## What stays the same
- Every field, required check, message, save behaviour and SAP/API call.
- Edit User window and the rest of User Management are untouched.

## Technical details
- Only the Create User dialog JSX in `src/routes/_authed.admin.users.tsx` changes; the unused `CreateUserSection` helper is removed.
- Styling uses existing design tokens only; no state, handler or validation code is edited.
