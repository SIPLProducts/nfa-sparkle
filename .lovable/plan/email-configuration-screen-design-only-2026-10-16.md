# Email Configuration — screen design only

## Scope
Create a clean, professional **Email Configuration** screen. As requested, this phase is UI-only: no credentials are saved, no real emails are sent, and NFA workflows remain unchanged.

## Screen design
- Add an **Email Configuration** entry under Admin, opening a dedicated page.
- Match the portal’s existing typography, brand colors, sidebar, buttons, and form controls.
- Use an uncluttered layout with three clearly separated sections: **Sender**, **Email server**, and **Test email**.
- Show sender email, email provider, host, port, username, and password/app password fields with consistent labels, alignment, and spacing.
- Provide an editable provider selector with a custom-provider option. Do not prefill any sender address, server, port, username, or password, or overwrite entered values when the provider changes.
- Mask the password by default, with an accessible visibility toggle for newly entered values.
- Include a test recipient email field and a **Send test email** control. Keep sending disabled with a concise “Not connected” status; never display simulated delivery or success messages.
- Include a disabled **Save configuration** control until secure saving is connected. Fields remain editable for reviewing the design.
- Arrange related fields in two columns where space permits, stacking into one column on smaller screens. Keep buttons and labels within the available width.

## Dynamic behavior and safeguards
- Manage input values in temporary page state only; do not use browser storage, database writes, or SMTP calls.
- Validate email formatting and numeric port input locally without changing any existing validations elsewhere.
- Discard password input when the page is left. Do not log credentials or include them in URLs.
- Leave SAP APIs, approval actions, notification routing, existing email behavior, and all other screens untouched.

## Technical details
- Create `src/routes/_authed.admin.email.tsx` at `/admin/email`, using the existing `AppShell`, `PageHeader`, and design-system controls.
- Reuse the existing SAP API Settings access permission for this design-only Admin page and sidebar entry; do not introduce new role assignments, permission storage, or backend changes in this phase.
- Add a page-specific title, description, and social metadata.
- Record the isolated UI-only boundary in `AGENTS.md` during implementation.

## Verification
- Check the page at desktop and narrow widths for alignment, readable fields, and unobstructed controls.
- Verify provider changes preserve entered values, password visibility works, and navigation respects existing access checks.
- Confirm no save or send requests occur, no credentials persist after leaving, and no fake success alerts appear.
- Check the preview for compilation and runtime errors.