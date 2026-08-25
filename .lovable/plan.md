# Fix deployed login 405 on Ubuntu quality server

## Confirmed issue

Your nginx config serves the frontend as static files on port **8081**:

```nginx
root /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist;
location / {
    try_files $uri $uri/ /index.html;
}
```

But the login page now uses a TanStack server function to resolve **User ID / Email ID** before signing in. That request goes to an internal path like:

```text
/_serverFn/...
```

Your nginx does not proxy `/_serverFn/*`, so the POST request falls into the static `location /` block. Static nginx cannot handle that POST and returns:

```text
405 Not Allowed
nginx/1.18.0
```

The backend REST/auth proxy locations are not enough for this login flow.

## Important note about your `.env`

Your current values point the browser to port **8081**:

```text
SUPABASE_URL="http://10.200.1.7:8081"
VITE_SUPABASE_URL="http://10.200.1.7:8081"
```

This can work only because nginx forwards `/auth/v1`, `/rest/v1`, `/storage/v1`, and `/realtime/v1` from **8081** to **8001**.

So the immediate 405 issue is not only the database URL. The missing piece is proxying the TanStack app runtime routes to the Node app server.

## Plan

1. Make sure the TanStack app server is running on its own local port.

Use a dedicated port, for example:

```text
127.0.0.1:3000
```

This is separate from:

```text
8001 = backend API/Kong
3004/3005 = SAP middleware
8081 = public frontend nginx port
```

2. Add nginx proxy rules for TanStack runtime routes before `location /`.

Add these blocks:

```nginx
# TanStack server functions used by login and other app actions
location /_serverFn/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# App-owned API routes, for example /api/public/create-user
location /api/public/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. Keep SAP middleware on a different path so it does not capture app APIs.

Your current block sends all `/api/` traffic to SAP middleware:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3005/;
}
```

That can break app routes like `/api/public/create-user`. Keep `/api/public/` above it, or move SAP middleware to a clearer prefix such as:

```nginx
location /sap-api/ {
    proxy_pass http://127.0.0.1:3005/;
}
```

4. Keep your backend API proxy blocks as they are.

These can remain proxied from 8081 to 8001:

```nginx
/auth/v1     -> 127.0.0.1:8001
/rest/v1     -> 127.0.0.1:8001
/storage/v1  -> 127.0.0.1:8001
/realtime/v1 -> 127.0.0.1:8001
```

5. Test and reload nginx.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

6. Verify in DevTools Network.

After hard refresh and login:

```text
POST http://10.200.1.7:8081/_serverFn/... should return 200, not 405
GET/POST http://10.200.1.7:8081/auth/v1/... should proxy to backend
GET http://10.200.1.7:8081/rest/v1/... should proxy to backend
```

## Recommended final nginx structure

```nginx
server {
    listen 8081;
    server_name _;

    root /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist;
    index index.html;

    client_max_body_size 25m;

    location /_serverFn/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/public/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/v1 {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rest/v1 {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /realtime/v1 {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /storage/v1 {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3005/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## One thing to confirm on the server

Check which port the TanStack app server is actually running on. Replace `3000` in the nginx config with the real app server port.

If you only copied `dist` static files and did not run the TanStack server bundle, then server functions cannot work. In that case, login will keep failing until the app server process is started and proxied.
