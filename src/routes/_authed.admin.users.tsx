import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, UserCog, UserX, UserCheck, Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLES, SCREENS, type Role, type ScreenKey } from "@/lib/screens";
import {
  createManagedUser,
  listManagedUsers,
  listRolePermissions,
  resetManagedUserPassword,
  saveRolePermissions,
  setManagedUserActive,
  updateManagedUser,
  type ManagedUser,
  type RolePermissionRow,
} from "@/lib/user-admin.functions";

export const Route = createFileRoute("/_authed/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management — NFA Portal" },
      { name: "description", content: "Create users, assign roles and control screen access for the NFA Portal." },
      { property: "og:title", content: "User Management — NFA Portal" },
      {
        property: "og:description",
        content: "Create users, assign roles and control screen access for the NFA Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserManagement,
});

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

function UserManagement() {
  const { hasRole, loading } = useAuth();
  const nav = useNavigate();
  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admins only");
      nav({ to: "/", replace: true });
    }
  }, [loading, isAdmin, nav]);

  if (!isAdmin) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="User Management"
        subtitle="Create users, assign roles and decide which screens each role can open."
      />
      <Tabs defaultValue="users" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="users" className="gap-2">
            <UserCog className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="perms" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Roles &amp; Permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="perms">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- users -------------------------------- */

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLES.map((r) => {
        const checked = value.includes(r.value);
        return (
          <label
            key={r.value}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) =>
                onChange(c ? [...value, r.value] : value.filter((v) => v !== r.value))
              }
            />
            {r.label}
          </label>
        );
      })}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listManagedUsers);
  const createFn = useServerFn(createManagedUser);
  const updateFn = useServerFn(updateManagedUser);
  const resetFn = useServerFn(resetManagedUserPassword);
  const activeFn = useServerFn(setManagedUserActive);

  const { data, isLoading } = useQuery({ queryKey: ["managed-users"], queryFn: () => fetchUsers() });
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [pwUser, setPwUser] = useState<ManagedUser | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["managed-users"] });

  const users = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!term) return rows;
    return rows.filter(
      (u) => u.email.toLowerCase().includes(term) || (u.full_name ?? "").toLowerCase().includes(term),
    );
  }, [data, q]);

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "User reactivated" : "User deactivated");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9" />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create user
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No users match your search.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">User</th>
                  <th className="px-4 py-2.5 text-left font-medium">Roles</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/70 odd:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="capitalize">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "default" : "outline"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(u)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          title="Reset password"
                          onClick={() => setPwUser(u)}
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Password
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={toggleActive.isPending}
                          onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}
                        >
                          {u.is_active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" /> Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (v) => {
          await createFn({ data: v });
          toast.success("User created");
          invalidate();
        }}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          await updateFn({ data: v });
          toast.success("User updated");
          invalidate();
        }}
      />
      <PasswordDialog
        user={pwUser}
        onClose={() => setPwUser(null)}
        onSubmit={async (v) => {
          await resetFn({ data: v });
          toast.success("Password updated");
        }}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { email: string; password: string; full_name: string; roles: Role[] }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(["initiator"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPassword("");
      setRoles(["initiator"]);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ email, password, full_name: fullName, roles });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>The account is confirmed immediately and can sign in right away.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password *</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Roles *</Label>
            <RolePicker value={roles} onChange={setRoles} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSubmit: (v: { id: string; full_name: string; roles: Role[] }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setRoles(user.roles);
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await onSubmit({ id: user.id, full_name: fullName, roles });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles *</Label>
            <RolePicker value={roles} onChange={setRoles} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSubmit: (v: { id: string; password: string }) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setPassword("");
  }, [user]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await onSubmit({ id: user.id, password });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New password *</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- permissions ------------------------------ */

function PermissionsTab() {
  const qc = useQueryClient();
  const fetchPerms = useServerFn(listRolePermissions);
  const saveFn = useServerFn(saveRolePermissions);
  const { data, isLoading } = useQuery({ queryKey: ["role-permissions"], queryFn: () => fetchPerms() });
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);

  const key = (r: Role, s: ScreenKey) => `${r}:${s}`;

  const current = useMemo(() => {
    if (draft) return draft;
    const m: Record<string, boolean> = {};
    for (const row of data ?? []) m[`${row.role}:${row.screen}`] = row.allowed;
    return m;
  }, [data, draft]);

  const save = useMutation({
    mutationFn: () => {
      const rows: RolePermissionRow[] = [];
      for (const r of ROLES) for (const s of SCREENS) rows.push({ role: r.value, screen: s.key, allowed: !!current[key(r.value, s.key)] });
      return saveFn({ data: { rows } });
    },
    onSuccess: () => {
      toast.success("Permissions saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  const locked = (r: Role, s: ScreenKey) => r === "admin" && s === "user_management";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                {SCREENS.map((s) => (
                  <th key={s.key} className="px-3 py-2.5 text-center font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.value} className="border-t border-border/70 odd:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  {SCREENS.map((s) => (
                    <td key={s.key} className="px-3 py-3 text-center">
                      <Checkbox
                        checked={locked(r.value, s.key) ? true : !!current[key(r.value, s.key)]}
                        disabled={locked(r.value, s.key)}
                        onCheckedChange={(c) => setDraft({ ...current, [key(r.value, s.key)]: !!c })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Admins always keep access to User Management so you cannot lock yourself out.
        </p>
        <div className="flex gap-2">
          {draft && (
            <Button variant="outline" onClick={() => setDraft(null)}>
              Discard
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            permissions
          </Button>
        </div>
      </div>
    </div>
  );
}