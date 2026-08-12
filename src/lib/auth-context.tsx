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
      .select("role, screen, allowed")
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        for (const r of (data ?? []) as { role: string; screen: string; allowed: boolean }[]) {
          m[`${r.role}:${r.screen}`] = r.allowed;
        }
        setPerms(m);
      });
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id)
            .then(({ data }) => setRoles((data ?? []).map((r: { role: Role }) => r.role)));
        }, 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .then(({ data: rd }) => setRoles((rd ?? []).map((r: { role: Role }) => r.role)));
      }
    });
    return () => sub.subscription.unsubscribe();
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