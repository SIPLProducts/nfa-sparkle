# Fix deployed login 405 on Ubuntu quality server

## What is happening

The login page now calls a backend server function before password sign-in so it can resolve either **User ID** or **Email ID**.

On the Ubuntu deployment, the error shown in the screenshot is an **nginx 405 Not Allowed** HTML page. That means the POST request is being handled by nginx/static files instead of the Node app server.

The current quality nginx config only proxies:

```text
/_serverFn/*
/api/*
```

If the deployed TanStack server-function request uses a different internal path, nginx will not proxy it and will return 405 for POST requests.

## Plan

1. Confirm the exact failed login request path from DevTools Network on the deployed server.
   - Expected symptom: a POST request during login returns nginx HTML `405 Not Allowed`.

2. Update the Ubuntu nginx app server block so all backend/runtime POST routes are proxied to the Node app, while static assets still serve from `/opt/enfa/frontend`.
   - Keep `/assets/` cached as static files.
   - Keep `/api/` proxied.
   - Add the missing TanStack server-function/internal route prefix once confirmed.
   - Ensure POST requests never fall through to `try_files /index.html`.

3. Update the deployment nginx template(s) in the repo so future deployments keep the fix.
   - Primary target: `deploy/nginx/nfa-quality.conf`.
   - Also align `deploy/nginx/enfa-qa.conf` if it is still used on the server.

4. Add a short troubleshooting note to the deployment README with the exact commands to apply on Ubuntu:

```text
sudo nginx -t
sudo systemctl reload nginx
pm2 restart <app-name>
```

5. Verify after reload:
   - Login with Email ID works.
   - Login with User ID works.
   - DevTools Network no longer shows nginx `405 Not Allowed` for the login resolve request.
   - The login either succeeds or returns a proper JSON/auth error.

## Server-side checks for you to run now

Before changing code, please run these on the Ubuntu server to confirm the diagnosis:

```bash
sudo tail -n 80 /var/log/nginx/nfa-quality-app.error.log
sudo tail -n 80 /var/log/nginx/nfa-quality-app.access.log
pm2 logs --lines 80
```

In DevTools Network, click the failing request and check the **Request URL**. If it is not under `/api/` or `/_serverFn/`, that is the route nginx is currently not proxying.
