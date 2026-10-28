# NFA Production setup (does not touch VMS or NFA Quality)

Ports: app 8091, API 8011, Studio 8092, middleware 3014
(internal: app 3010, middleware 3015, Kong 54421, DB 54422, Studio 54423).

## 0. Check ports are free
    sudo ss -tulpn | grep -E ':(8091|8011|8092|3014|3010|3015|5442[1-4])\b'
Nothing should print.

## 1. Upload (WinSCP)
Upload `Production/` to `/apps/webapplications/NFA_Approval/Production/`
and `nginx/enfa-production.conf` to `/apps/webapplications/NFA_Approval/nginx/`.

## 2. Backend
    cd /apps/webapplications/NFA_Approval/Production/backend
    bash ../scripts/generate-keys.sh        # new secrets, never reuse Quality's
    cp .env.example .env && nano .env       # paste keys, set passwords, server IP 10.200.1.7
    docker compose -p nfa-production -f docker-compose.yml up -d
    docker ps | grep nfa-production
    cd ../scripts && DRY_RUN=1 bash run-migrations.sh && bash run-migrations.sh
Then run `seed-admin.sql` in Studio (http://10.200.1.7:8092).

## 3. Middleware
    cd ../middleware
    cp .env.example .env && cp systems.example.json systems.json   # set PRODUCTION SAP system
    npm install --production
    pm2 start ecosystem.config.cjs && pm2 save

## 4. Frontend
On Windows: set the frontend .env values (from Production/frontend/.env.example), `npm run build`,
upload `dist` to `Production/frontend/dist`, copy `.env` there, then:
    cd /apps/webapplications/NFA_Approval/Production/frontend
    PORT=3010 pm2 start dist/server/index.mjs --name enfa-production-app && pm2 save

## 5. Nginx
    sudo ln -sf /apps/webapplications/NFA_Approval/nginx/enfa-production.conf /opt/Ramky_Applications/nginx/enfa-production.conf
    sudo htpasswd -c /etc/nginx/enfa-production-studio.htpasswd enfa-production-admin
    sudo nginx -t && sudo systemctl reload nginx
Only reload if `nginx -t` says OK.

## 6. Check
    curl -I http://127.0.0.1:8091/auth     # 200
    curl -I http://127.0.0.1:8081/auth     # Quality still 200
    pm2 list

In SAP API Settings (Production), point endpoints to the Production SAP system/client.
