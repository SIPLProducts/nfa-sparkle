import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role, ScreenKey } from "@/lib/screens";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
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

  useEffect(() => {
    supabase
      .from("role_permission")
      .select("role_key, screen, allowed")
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        for (const r of (data ?? []) as { role_key: string | null; screen: string; allowed: boolean }[]) {
          if (r.role_key) m[`${r.role_key}:${r.screen}`] = r.allowed;
        }
        setPerms(m);
      });
  }, []);

  async function loadRoles(userId: string) {
    const [sys, custom] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_role_assignment").select("role_key").eq("user_id", userId),
    ]);
    const list = [
      ...((sys.data ?? []) as { role: string }[]).map((r) => r.role),
      ...((custom.data ?? []) as { role_key: string }[]).map((r) => r.role_key),
    ];
    setRoles(Array.from(new Set(list)));
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(s: Session | null) {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadRoles(s.user.id);
      } else {
        setRoles([]);
      }
      if (!cancelled) setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setLoading(true);
      void bootstrap(s);
    });

    supabase.auth.getSession().then(({ data }) => {
      void bootstrap(data.session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthCtx = {
    user,
    session,
    loading,
    roles,
    hasRole: (r) => roles.includes(r),
    canAccess: (s) => {
      if (roles.length === 0) return false;
      if (Object.keys(perms).length === 0) return roles.includes("admin");
      return roles.some((r) => perms[`${r}:${s}`]);
    },
    signOut: async () => {
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