# Fix "Email configuration is incomplete" on Send test email

## Why it happens
Send test email uses the settings already **saved** on the server, not what is typed on screen. Nothing has been saved yet (the screen shows "App password not saved yet"), so the server finds no host, port or From Email and stops with this message.

## Fix
- Pressing **Send test email** sends the values currently on screen (host, port, encryption, username, app password, From Email, From Name). If the password box is empty, it uses the saved password.
- The test does not save anything. Save configuration still works the same.
- If something is still missing, the message names it, for example "Enter SMTP Host, Port, From Email" or "Enter the App Password".
- Real mail server errors (wrong password, blocked login) still show in the popup as they are.

## Note for Gmail (from your second screenshot)
Your settings are now saved, but **Username is "prasad"** — Gmail rejects that. Username must be the full Gmail address (`kvvkkunchala@gmail.com`, same as From Email), with a 16-character Google **App Password** (2-Step Verification on), Port 587, TLS.
- Add a hint under Username: "Use the full mailbox address (e.g. same as From Email)". No change to saving.

## Technical details
- `sendTestEmail` input accepts optional draft config + password; validates it and passes it to `sendTestMail`.
- `workflow-mail.server.ts`: `transport(override?)` builds from the override merged over saved config; returns a specific missing-field list.
- `_authed.admin.email.tsx`: test handler passes current form state. No other screens, workflow emails or database changes.
