# Studio port confusion + running migrations on the Quality server

## Answering your questions

**Which port is the dashboard?**
- Port **8001** is NOT the dashboard. 8001 is the Supabase **API** (Kong gateway) — the app talks to it for auth/data.
- The dashboard (Studio, your screenshot) is on port **8082** — and your screenshot at `10.200.1.7:8082/project/default/editor` shows it is already working. So that part is correct.

**The error in your screenshot** — `password authentication failed for user "supabase_admin"` — is the same stale database-password problem we identified before. The DB volume was created with a different password than your current `.env`. The fix script already exists in the repo at `deployment/Quality/scripts/fix-db-roles.sh`; it just needs to be copied to the server and run once.

**Your migrations folder is in the wrong place.** You have:

```text
/apps/webapplications/NFA_Approval/Quality/backend/volumes/migrations
```

but the migration script looks in:

```text
/apps/webapplications/NFA_Approval/Quality/backend/migrations
```

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
