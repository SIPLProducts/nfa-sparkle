# Restore ENFA approval emails (middleware DNS timeout)

## What the logs show
- The approval logic is working. Every recent attempt picked the right people for both Predefined and Dynamic approvals (for example 100217, read from the Dynamic Approvals list).
- Emails sent fine through the middleware until 05:33 UTC (100215, 100216, 100209). From 05:41 every attempt failed with the same error from the middleware: `queryA ETIMEOUT smtp.gmail.com`.
- None of the portal code that sends email through the middleware changed between those times. What changed is the network on the middleware PC: it can no longer look up Gmail's mail server address in time.
- Why it fails even when the PC has internet: the mail library asks the configured DNS server directly ("queryA"). When that request times out, the library gives up. It never tries the PC's normal address lookup (Windows/OS cache, hosts file, VPN DNS), which often still works.
- Your screenshot shows the "NFA Portal test email" arrived at 11:32 from noreply@ramky.com. The test email goes through the same sending path as approval emails. So the mail settings and password are fine, and the address lookup fails only some of the time. That's why one attempt can work while the next three fail.
- Your local test logged nothing in the email history after 05:56. So the website copy you're testing locally is probably an older version: it stopped at the first middleware failure and never tried the direct fallback.

## Fix (email delivery only; approval logic, recipients, SAP calls and templates stay the same)
1. **Middleware `/mail/send`:** before connecting, look up the mail server address in this order:
   - the PC's normal lookup
   - the configured DNS, tried again once
   - public DNS (Google 8.8.8.8, then Cloudflare 1.1.1.1)
   
   It then connects to the address it found. The security check still uses the real server name (`smtp.gmail.com`), so encryption and login work as before. It also remembers the last address that worked and uses it if a later lookup times out. If a send still fails with a lookup or connection timeout, it retries once after a short pause. If every lookup fails, it returns a clear message saying the middleware PC can't reach the mail server's DNS.
2. **Portal direct fallback:** when the portal sends mail itself (the relay is down or returns a network error), it uses the same address lookup. This only applies where the portal runs on a normal server; the hosted site always uses the relay, as it does now.
3. Apply the same middleware change to the Quality middleware copy, and rebuild the downloadable middleware package.

## How it will be checked
- A small automated check for the lookup order: normal lookup first, then public DNS, and a clear error when every lookup fails.
- Run the email routing checks that already exist (Predefined and Dynamic) to confirm the recipients are unchanged.
- Send a test email through the updated middleware code from here.

## What you'll need to do locally
- Replace the middleware with the new package and restart it.
- Make sure your local website runs the latest code.
- Approve an NFA. The middleware console should show `MAIL sent to ...`, and the email history should show `sent`.

## Technical details
- `middleware/server.js` and `deployment/Quality/middleware/server.js`: add `resolveSmtpHost(host)`. It tries `dns.promises.lookup`, then a `dns.Resolver` retry, then a `Resolver` pointed at `8.8.8.8` and `1.1.1.1`. Pass `host: ip` and `tls: { servername: host }` to `nodemailer.createTransport`. Map `ETIMEOUT`/`ENOTFOUND` to a readable message with `code: "EDNS"`.
- `src/lib/workflow-mail.server.ts`: use the same pre-resolution in the direct-send branch, guarded so that a missing `node:dns` (Worker runtime) falls back to the current behaviour.
- Rebuild `/mnt/documents/middleware.zip`, keeping the local `.env` and `systems.json` untouched.
