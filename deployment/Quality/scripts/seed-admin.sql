-- eNFA QUALITY - grant the admin role to the first login.
--
-- 1. Create the user in Studio (http://<SERVER_IP>:8082)
--       Authentication -> Add user -> tick "Auto Confirm User"
-- 2. Run this file with that user's email:
--
--    PGPASSWORD='<POSTGRES_PASSWORD>' psql -h 127.0.0.1 -U postgres -d postgres \
--      -v admin_email="'admin@ramky.com'" -f deploy/scripts/seed-admin.sql

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_email text := :'admin_email';
  v_uid   uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %. Create it in Studio first (Auto Confirm).', v_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- profile row, if the table is present in this schema version
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name)
    VALUES (v_uid, split_part(v_email, '@', 1))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RAISE NOTICE 'admin role granted to % (%)', v_email, v_uid;
END
$$;

SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
ORDER BY u.email;
