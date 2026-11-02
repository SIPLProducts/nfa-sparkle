# Redesign the Create User window

Only the look of the Create User window changes. Every field, check, message and what gets saved stays the same.

## New layout
- **Header**: icon badge, "Create user" title and the existing subtitle, with a thin divider below. Close button stays top-right.
- **Wider window** (about 720px on desktop, full width on phones) so fields line up in two neat columns instead of leaving gaps (such as Designation sitting alone today).
- **Grouped sections**, each with a small heading and short hint:
  1. **Account** – User ID (with its help text), Status
  2. **Personal details** – First name, Last name, Email, Contact
  3. **Organisation** – Company Name, Department, Designation, Role
  4. **Security** – Password, Confirm password (show/hide eye buttons kept)
- Sections sit in soft cards with consistent spacing; required fields keep the red asterisk; error messages ("Department is required", SAP retry, etc.) stay under their field.
- Only the middle scrolls; the header and the button bar stay fixed so Cancel / Create user are always visible.
- **Footer**: divider, Cancel and Create user aligned right on desktop, full-width stacked on phones; spinner while saving unchanged.
- On phones every section collapses to one column.

## Technical details
- Edit only the JSX/classes inside `CreateUserDialog` in `src/routes/_authed.admin.users.tsx`; state, handlers, `submit`, validations and server calls untouched.
- Use existing theme tokens (`bg-muted/40`, `border`, `text-muted-foreground`, `text-destructive`); no hardcoded colors.
- Edit User, Reset Password and Roles dialogs are not changed.
