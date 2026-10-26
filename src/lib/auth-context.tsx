import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role, ScreenKey } from "@/lib/screens";
import { clearScreenState } from "@/lib/screen-state";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  accessError: string | null;
  retryAccess: () => void;
  hasRole: (r: Role) => boolean;
  canAccess: (s: ScreenKey) => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  async function loadPermissions() {
    const { data, error } = await supabase
      .from("role_permission")
      .select("role_key, screen, allowed");
    if (error) {
      console.error("Unable to load screen permissions", error);
      setPermissionError(`Unable to load screen permissions: ${error.message}`);
      setPerms({});
      return false;
    }
    const nextPermissions: Record<string, boolean> = {};
    for (const row of (data ?? []) as { role_key: string | null; screen: string; allowed: boolean }[]) {
      if (row.role_key) nextPermissions[`${row.role_key}:${row.screen}`] = row.allowed;
    }
    setPerms(nextPermissions);
    setPermissionError(null);
    return true;
  }

  async function loadRoles(userId: string) {
    const { data, error } = await supabase.from("user_role_assignment").select("role_key").eq("user_id", userId);
    if (error) {
      console.error("Unable to load user roles", error);
      setRoleError(`Unable to load user roles: ${error.message}`);
      setRoles([]);
      return false;
    }
    const list = ((data ?? []) as { role_key: string }[]).map((r) => r.role_key);
    setRoles(Array.from(new Set(list)));
    setRoleError(null);
    return true;
  }

  /** Loads roles + permissions, retrying transient failures so a blip never looks like "no access". */
  async function loadAccess(userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [r, p] = await Promise.all([loadRoles(userId), loadPermissions()]);
        if (r && p) return;
      } catch (e) {
        console.error("Unable to load access", e);
        setRoleError(`Unable to load your access: ${(e as Error)?.message ?? e}`);
      }
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let currentUserId: string | null = null;
    let accessLoad: Promise<void> | null = null;

    async function bootstrap(s: Session | null, initial: boolean) {
      const nextId = s?.user?.id ?? null;
      const sameUser = nextId !== null && nextId === currentUserId;

      setSession(s);
      setUser(s?.user ?? null);

      // Token refresh / tab focus events re-fire with the same user: keep the
      // tree mounted. If getSession and INITIAL_SESSION overlap, both wait
      // for the same access request before the app can consider auth ready.
      if (s?.user) {
        if (!sameUser) {
          currentUserId = nextId;
          setAccessLoading(true);
          accessLoad = loadAccess(s.user.id).finally(() => {
            if (!cancelled) setAccessLoading(false);
          });
        }
        await accessLoad;
      } else {
        currentUserId = null;
        accessLoad = null;
        setRoles([]);
        setPerms({});
        setPermissionError(null);
        setRoleError(null);
        setAccessLoading(false);
      }
      if (!cancelled && initial) setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void bootstrap(s, false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error("getSession failed", error);
        void bootstrap(data.session ?? null, true);
      })
      .catch((err) => {
        console.error("getSession exception", err);
        void bootstrap(null, true);
      });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Manual retry from the "Unable to load your access" screen.
  useEffect(() => {
    if (!retryTick || !user) return;
    let cancelled = false;
    setAccessLoading(true);
    void loadAccess(user.id).finally(() => { if (!cancelled) setAccessLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  const value: AuthCtx = {
    user,
    session,
    // Auth is not "ready" until the signed-in user's access has loaded, so no screen
    // makes an access decision from empty roles.
    loading: loading || accessLoading,
    roles,
    accessError: roleError ?? permissionError,
    retryAccess: () => setRetryTick((t) => t + 1),
    hasRole: (r) => roles.includes(r) || roles.includes(`custom_${r}`),
    canAccess: (s) => {
      if (roles.length === 0) return false;
      if (Object.keys(perms).length === 0) return roles.includes("custom_admin");
      return roles.some((r) => perms[`${r}:${s}`]);
    },
    signOut: async () => {
      clearScreenState();
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}