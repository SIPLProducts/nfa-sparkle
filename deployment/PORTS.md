# Port discovery and allocation — 10.200.1.7

## 1. Find what is already in use (run this FIRST)

```bash
sudo ss -tulpn | sort -t: -k2 -n
docker ps --format 'table {{.Names}}\t{{.Ports}}'
pm2 list
sudo ls /etc/nginx/sites-enabled/
sudo grep -rhn "listen" /etc/nginx/sites-enabled/ | sort -u
```

Write down every occupied port before continuing. If any port below appears in
that output, change it in the three places it is referenced:
`nginx/enfa-quality.conf`, `Quality/backend/.env`, `Quality/frontend/.env`.

## 2. Allocation

| Service | Quality | Production | Bind |
| --- | --- | --- | --- |
| Frontend (nginx, public) | 8081 | 8091 | 0.0.0.0 |
| Supabase API / Kong (nginx, public) | 8001 | 8011 | 0.0.0.0 |
| Supabase Studio (nginx, public, IP-restricted) | 8082 | 8092 | 0.0.0.0 |
| SAP middleware (nginx, public) | 3004 | 3014 | 0.0.0.0 |
| App Node SSR | 3000 | 3010 | 127.0.0.1 |
| Middleware Node | 3005 | 3015 | 127.0.0.1 |
| Kong container | 54321 | 54421 | 127.0.0.1 |
| PostgreSQL container | 54322 | 54422 | 127.0.0.1 |
| Studio container | 54323 | 54423 | 127.0.0.1 |
| Kong HTTPS (unused placeholder) | 54324 | 54424 | 127.0.0.1 |

Only the four "public" rows are reachable from the network; everything else is
bound to loopback so nginx is the single entry point.

## 3. Firewall (optional, if ufw is active)

```bash
sudo ufw status
sudo ufw allow 8081/tcp
sudo ufw allow 8001/tcp
sudo ufw allow 8082/tcp
sudo ufw allow 3004/tcp
```

Do not touch rules belonging to the existing applications.
