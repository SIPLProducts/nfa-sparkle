# Fix deployed login on Ubuntu quality server

## Confirmed issue

The failing request is:

```text
http://10.200.1.7:8081/rest/v1/role_permission?... 401 Unauthorized
```

That URL is wrong for the deployed setup. Port **8081** is the frontend/app port. Database/auth REST requests must go to the backend API port **8001**.

So the deployed browser bundle was likely built with:

```text
VITE_SUPABASE_URL=http://10.200.1.7:8081
```

or an equivalent wrong value. It should be:

```text
VITE_SUPABASE_URL=http://10.200.1.7:8001
```

Because `VITE_*` values are embedded during build, changing the env file alone is not enough. The app must be rebuilt and redeployed after fixing the value.

## Plan

1. Update the server env file used for build and runtime.

```bash
sudo nano /opt/enfa/app.env
```

Set these values:

```text
SUPABASE_URL=http://10.200.1.7:8001
VITE_SUPABASE_URL=http://10.200.1.7:8001
```

Keep the publishable/anon key values unchanged unless they are also wrong.

2. Rebuild the frontend bundle with the corrected env loaded.

From the app source folder:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a
. /opt/enfa/app.env
set +a
npm run build
```

3. Copy the rebuilt static frontend and server output to the paths used by nginx/systemd/PM2.

Use the same copy commands from your deployment process, making sure:

```text
frontend files -> /opt/enfa/frontend
server bundle  -> app server folder used by PM2/systemd
```

4. Restart the app process.

If PM2 is managing the app:

```bash
pm2 restart <NFA app process name>
pm2 save
```

If systemd is managing it:

```bash
sudo systemctl restart enfa-app
```

5. Verify in browser DevTools Network.

After hard refresh, login again and confirm database/auth requests now go to:

```text
http://10.200.1.7:8001/rest/v1/...
http://10.200.1.7:8001/auth/v1/...
```

They should no longer go to:

```text
http://10.200.1.7:8081/rest/v1/...
```

## Optional repo update

Add a clear deployment note to the repo docs emphasizing that `VITE_SUPABASE_URL` must point to port **8001**, not **8081**, and that a rebuild is required after any `VITE_*` change.
