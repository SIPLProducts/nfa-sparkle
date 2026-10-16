# Email Configuration — screenshot-inspired layout

## Design changes
- Use a compact Email Configuration heading with an envelope icon and a constrained, centered form matching the reference’s proportions.
- Replace the current three wide section bands with one bordered configuration form, a clear heading, and a compact connection-status indicator.
- Arrange the existing fields in a balanced two-column grid: email provider and sender email, SMTP host and port, username and password/app password. Keep the custom provider field conditional and retain the password visibility control.
- Place the test recipient at the bottom, separated by a subtle divider, with Send Test Email and Save Configuration aligned to the right on larger screens.
- Use the portal’s existing semantic colors, restrained accent icons, subtle borders, consistent field heights, and tighter spacing inspired by the screenshot.
- Stack fields and action controls cleanly on narrow screens without clipping or horizontal scrolling.

## Scope safeguards
- Do not include a Reply Email field.
- Use the screenshot as a visual reference only: do not add its tabs, enable switch, encryption settings, From Name, or CC recipient controls, since those would introduce configuration behavior outside this request.
- Preserve all existing editable values, provider choices, validation, password toggle, access permissions, and temporary page-only state.
- Keep Save Configuration and Send Test Email disabled; this remains a design-only screen with no stored credentials or email delivery.
- Leave the sidebar, other screens, API integrations, and business logic unchanged. Do not copy account details or sample configuration values from the screenshot.

## Technical scope
- Update presentation in `src/routes/_authed.admin.email.tsx` using existing shared controls and semantic tokens.
- Preserve the route and its page-specific metadata.

## Verification
- Check the layout at the current preview size and a narrow phone width.
- Confirm field validation, custom provider visibility, and password visibility work as before.
- Confirm saving and test sending remain disabled and no Reply Email field appears.
- Check preview diagnostics; if the available account lacks SAP API Settings permission, report that limitation rather than changing permissions.