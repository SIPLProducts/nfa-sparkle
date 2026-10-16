# Email Configuration — screenshot field set

## Goal
Make the Email Configuration screen show exactly the fields from the provided screenshot, plus the existing test email section. All fields stay empty by default (no sample values copied from the screenshot). This remains a design-only screen: nothing is saved or sent, and no other screen or workflow changes.

## Screen content
- Heading "No Reply Email Configuration" with an envelope icon and the screenshot's one-line explanation ("System sender used for ... notifications ... outbound notifications go through this account.").
- **Enable No-Reply Sending** toggle band with the "When off, system notifications are not sent." hint. Interactive page state only; defaults to off.
- Two-column field grid (stacks to one column on narrow screens):
  - SMTP Host | Port
  - Encryption (select: TLS (587), SSL, None — no preselection) | Username
  - App Password ("leave empty to keep existing" hint, masked with eye toggle) | From Email
  - From Name | CC Recipients (optional)
- **CC Recipients**: chip-style list with an "Add another..." input; Enter or comma adds a chip, × removes one, invalid addresses show a local validation message. Starts empty.
- Divider, then the existing test email row: "Send test to" field with disabled **Send test email**, and disabled **Save configuration** beside it, plus the "Configuration not connected" note.

## Changes to the current screen
- Remove: Sender email field (replaced by From Email), the Email provider selector and its conditional custom-provider field.
- Add: Enable toggle, Encryption select, From Name, CC Recipients chips.
- Keep: page-local temporary state discarded on navigation, email/port validation, disabled Save/Send controls, "Not connected" status, page metadata, `/admin/email` route, and the SAP API Settings access guard.

## Scope safeguards
- No backend, storage, credentials, or email delivery changes; no new permissions.
- Do not copy any sample values from the screenshot (no host, port, username, sender, names, or recipient emails).
- Leave the sidebar, other screens, and all business logic untouched.

## Technical scope
- Update `src/routes/_authed.admin.email.tsx` only, using existing shared controls (`PageHeader`, `Button`, `Input`, `Label`, `Select`, design-system tokens and a small `Switch` if one already exists in the UI kit — otherwise a styled toggle button with `aria-pressed`).
- CC chips state is a simple string array managed in the existing page-local state.

## Verification
- Desktop and narrow widths: two-column grid stacks cleanly, no clipping or horizontal scroll.
- Toggle works, password eye toggle works, CC chips add/remove and validate, port validation unchanged.
- Save Configuration and Send Test Email remain disabled; no requests are sent; navigating away clears all values.
- Preview builds and runs without errors.
