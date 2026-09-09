# Fix the dashboard error, then run the migrations

## Your three questions answered

**1. Can I swap the dashboard to 8001 and the gateway to 8082?**
Technically yes — it is only two numbers in the nginx file. But it is not worth it:
the app was built with the API address baked in as 8001, so swapping means
rebuilding the whole app and redeploying `dist/` again. Recommendation: keep
8001 = API, 8082 = dashboard. If you still want the swap, it can be done later
as a separate change.

**2. Do I move the migrations from `volumes/` to `backend/`?**
Yes. Move `backend/volumes/migrations` to `backend/migrations`.

**3. Fix the dashboard error first?**
Yes — do the password repair first, then the migrations. The
`password authentication failed for user "supabase_admin"` message means the
database volume still holds an older password than the one in your `.env`.
The repair script already exists in the repo at
`deployment/Quality/scripts/fix-db-roles.sh`.


## Plan

### 1. Fix Studio / backend database passwords (one time)

Copy `deployment/Quality/scripts/fix-db-roles.sh` from the repo to the server, then run:

```bash
cd /apps/webapplications/NFA_Approval/Quality
chmod +x scripts/fix-db-roles.sh
# reads POSTGRES_PASSWORD from backend/.env
./scripts/fix-db-roles.sh
```

This repairs only the `nfa-quality-db` roles and restarts only the Quality containers (auth, realtime, meta). Nothing else on the server is touched. After it finishes, refresh Studio on 8082 — "Failed to load schemas" should be gone.

### 2. Move the migrations to the expected folder and run them

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
mv volumes/migrations ./migrations        # or: cp -r volumes/migrations ./migrations
```

Copy `deployment/Quality/scripts/run-migrations.sh` from the repo into `Quality/scripts/`, then:

```bash
cd /apps/webapplications/NFA_Approval/Quality
chmod +x scripts/run-migrations.sh
PGPASSWORD='<POSTGRES_PASSWORD from backend/.env>' ./scripts/run-migrations.sh
```

The script auto-detects the DB port from Docker, applies each file once, and records what it applied so re-runs are safe.

### 3. Verify

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep nfa-quality
```

All `nfa-quality-*` containers should be `healthy`. Then in Studio (8082) the table editor should list the tables (nfa, nfa_approver, profiles, ...).

### 4. Repo doc change (only file edit)

Update `deployment/README.md` so the Quality setup section states clearly:
- 8081 = app, 8001 = API (not the dashboard), 8082 = Studio dashboard, 3004 = middleware.
- Migrations must live at `Quality/backend/migrations` (not under `volumes/`), or pass `MIGRATIONS_DIR=...` to `run-migrations.sh`.
- Run `fix-db-roles.sh` once after the first stack start, before opening Studio.

## Port reference (Quality)

| Port | What it is |
| --- | --- |
| 8081 | The app (login page) |
| 8001 | Supabase API only — used by the app, no UI |
| 8082 | Supabase Studio dashboard (your screenshot) |
| 3004 | SAP middleware |

No application code changes. No other apps, containers, ports, or volumes are touched.
