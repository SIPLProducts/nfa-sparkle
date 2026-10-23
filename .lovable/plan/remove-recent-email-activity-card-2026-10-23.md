# Remove "Recent email activity" card

## What changes
- On the Email Configuration screen, the "Recent email activity" card below the settings form is removed.

## Not changing
- The email settings form, Save and Send test buttons, and status label stay as they are.
- Workflow emails keep sending, and each attempt is still recorded on the server.

## Technical details
- `src/routes/_authed.admin.email.tsx`: remove the `<EmailActivity />` render, the `EmailActivity` component, the `ACTION_LABEL` map, and the `getEmailLog` import. The server function and `email_log` table stay in place.
