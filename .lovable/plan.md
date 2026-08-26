# Fix User Management screens and roles on the Quality server

## Actual issue

From the server output, the problem is not the login anymore. The deployment folder is missing two things the scripts require:

1. **Migrations are not available on the server**

You ran:

```bash
/opt/Ramky_Applications/NFA-Approval/Quality/scripts/run-migrations.sh
```

It reported:

```text
No migrations directory at /opt/Ramky_Applications/NFA-Approval/Quality/supabase/migrations
```

So the Quality server does not currently have the repo migration folder in the expected place. Because of that, the database may be missing/backfilled incorrectly for:

- `role_permission.role_key`
- `app_role_def`
- `user_role_assignment`
- latest `profiles` fields used by Create User

2. **Frontend env file is missing**

`deploy-quality.sh` reported:

```text
Missing /opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
```

You edited:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/.env
```

But the frontend app server needs its own env file at:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
```

## Immediate SQL to repair roles, screens, and admin access

Run this against the Quality database from the server. Replace the email only if your master admin email is different.

```bash
PGPASSWORD='<POSTGRES_PASSWORD>' psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v admin_email="'masteradmin@sharviinfotech.com'"
```

Then paste this SQL:

```sql
\set ON_ERROR_STOP on

-- 1) Ensure role definitions exist
CREATE TABLE IF NOT EXISTS public.app_role_def (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_role_def TO authenticated;
GRANT ALL ON public.app_role_def TO service_role;
ALTER TABLE public.app_role_def ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_role_def' AND policyname = 'role defs readable'
  ) THEN
    CREATE POLICY "role defs readable"
    ON public.app_role_def FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

INSERT INTO public.app_role_def(key, name, description, is_system) VALUES
  ('initiator','Initiator','Can create and submit NFAs',true),
  ('approver','Approver','Can act on NFAs assigned to them',true),
  ('admin','Admin','Full administrative access',true),
  ('viewer','Viewer','Read-only access to NFA reports',true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- 2) Ensure role_permission has the column used by the app
ALTER TABLE public.role_permission ADD COLUMN IF NOT EXISTS role_key text;
UPDATE public.role_permission SET role_key = role::text WHERE role_key IS NULL AND role IS NOT NULL;

GRANT SELECT ON public.role_permission TO authenticated;
GRANT ALL ON public.role_permission TO service_role;
ALTER TABLE public.role_permission ENABLE ROW LEVEL SECURITY;

-- 3) Ensure all built-in screen permissions exist
INSERT INTO public.role_permission (role, role_key, screen, allowed) VALUES
  ('initiator','initiator','dashboard',true),
  ('initiator','initiator','nfa_new',true),
  ('initiator','initiator','nfa_my',true),
  ('initiator','initiator','approvals',false),
  ('initiator','initiator','report',false),
  ('initiator','initiator','sap_api',false),
  ('initiator','initiator','user_management',false),

  ('approver','approver','dashboard',true),
  ('approver','approver','nfa_new',false),
  ('approver','approver','nfa_my',true),
  ('approver','approver','approvals',true),
  ('approver','approver','report',false),
  ('approver','approver','sap_api',false),
  ('approver','approver','user_management',false),

  ('viewer','viewer','dashboard',true),
  ('viewer','viewer','nfa_new',false),
  ('viewer','viewer','nfa_my',false),
  ('viewer','viewer','approvals',false),
  ('viewer','viewer','report',true),
  ('viewer','viewer','sap_api',false),
  ('viewer','viewer','user_management',false),

  ('admin','admin','dashboard',true),
  ('admin','admin','nfa_new',true),
  ('admin','admin','nfa_my',true),
  ('admin','admin','approvals',true),
  ('admin','admin','report',true),
  ('admin','admin','sap_api',true),
  ('admin','admin','user_management',true)
ON CONFLICT DO NOTHING;

-- 4) Ensure custom role assignment table exists
CREATE TABLE IF NOT EXISTS public.user_role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_key text NOT NULL REFERENCES public.app_role_def(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);

GRANT SELECT ON public.user_role_assignment TO authenticated;
GRANT ALL ON public.user_role_assignment TO service_role;
ALTER TABLE public.user_role_assignment ENABLE ROW LEVEL SECURITY;

-- 5) Ensure profile columns needed by Create User exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 6) Ensure role check function used by User Management exists
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = _role
  ) OR EXISTS (
    SELECT 1 FROM public.user_role_assignment ura
    WHERE ura.user_id = _user_id AND ura.role_key = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO service_role;

-- 7) Grant admin role to master admin user
DO $$
DECLARE
  v_email text := :'admin_email';
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %', v_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_role_assignment (user_id, role_key)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role_key) DO NOTHING;

  UPDATE public.profiles
  SET status = 'ACTIVE', is_active = true
  WHERE id = v_uid;

  RAISE NOTICE 'Admin role confirmed for % (%)', v_email, v_uid;
END $$;

-- 8) Verify result
SELECT role_key, screen, allowed
FROM public.role_permission
ORDER BY role_key, screen;

SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower(:'admin_email')
ORDER BY u.email, r.role;
```

After this, type:

```sql
\q
```

Then sign out and sign in again at:

```text
http://10.200.1.7:8081
```

## Required file/folder correction

For future deployments, the server needs the project layout, not only the `scripts` folder:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/
  frontend/
    dist/
    package.json
    supabase/migrations/       <- must exist if scripts run from frontend repo
    deploy/env/app.env.quality.example
  frontend.env                 <- required by deploy-quality.sh in your current layout
  scripts/
    run-migrations.sh
    deploy-quality.sh
    seed-admin.sql
```

If you keep scripts at `/Quality/scripts`, set the migration folder explicitly:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/scripts
MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/frontend/supabase/migrations ./run-migrations.sh
```

And create the missing frontend env file from the app env example:

```bash
cp /opt/Ramky_Applications/NFA-Approval/Quality/frontend/deploy/env/app.env.quality.example \
   /opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
nano /opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
```

Use the anon/public key and backend URL values from your Quality backend `.env`, but do not put the service role key in any `VITE_` variable.
