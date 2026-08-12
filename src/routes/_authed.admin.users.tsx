import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  UserCheck,
  Save,
  Trash2,
  Shield,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { SCREENS, type Role, type ScreenKey } from "@/lib/screens";
import {
  createManagedUser,
  createRoleDef,
  deleteRoleDef,
  listManagedUsers,
  listRoleDefs,
  listRolePermissions,
  resetManagedUserPassword,
  saveRolePermissions,
  setManagedUserActive,
  updateManagedUser,
  updateRoleDef,
  type ManagedUser,
  type RoleDef,
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

function useRoleDefs() {
  const fetchRoles = useServerFn(listRoleDefs);
  return useQuery({ queryKey: ["role-defs"], queryFn: () => fetchRoles() });
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
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="perms" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Screen Permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
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
  const { data: roleDefs, isLoading } = useRoleDefs();
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  return (
    <div className="grid grid-cols-2 gap-2">
      {(roleDefs ?? []).map((r) => {
        const checked = value.includes(r.key);
        return (
          <label
            key={r.key}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) =>
                onChange(c ? [...value, r.key] : value.filter((v) => v !== r.key))
              }
            />
            {r.name}
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

/* --------------------------------- roles -------------------------------- */

function RolesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useRoleDefs();
  const createFn = useServerFn(createRoleDef);
  const updateFn = useServerFn(updateRoleDef);
  const deleteFn = useServerFn(deleteRoleDef);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDef | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["role-defs"] });
    qc.invalidateQueries({ queryKey: ["role-permissions"] });
  };

  const remove = useMutation({
    mutationFn: (key: string) => deleteFn({ data: { key } }),
    onSuccess: () => {
      toast.success("Role deleted");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Roles decide which screens a user can open. Built-in roles cannot be renamed or removed.
        </p>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create role
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Users</th>
                <th className="px-4 py-2.5 text-left font-medium">Screens</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.key} className="border-t border-border/70 odd:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.is_system && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          System
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.description || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.user_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.screen_count} / {SCREENS.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={r.is_system}
                        title={r.is_system ? "Built-in roles cannot be edited" : "Edit role"}
                        onClick={() => setEditing(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive"
                        disabled={r.is_system || remove.isPending}
                        title={r.is_system ? "Built-in roles cannot be deleted" : "Delete role"}
                        onClick={() => remove.mutate(r.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RoleDialog
        open={createOpen}
        role={null}
        onOpenChange={setCreateOpen}
        onSubmit={async (v) => {
          await createFn({ data: v });
          toast.success("Role created");
          invalidate();
        }}
      />
      <RoleDialog
        open={!!editing}
        role={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={async (v) => {
          if (!editing) return;
          await updateFn({ data: { key: editing.key, ...v } });
          toast.success("Role updated");
          invalidate();
        }}
      />
    </div>
  );
}

function RoleDialog({
  open,
  role,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  role: RoleDef | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { name: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
    }
  }, [open, role]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ name, description });
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
          <DialogTitle>{role ? "Edit role" : "Create new role"}</DialogTitle>
          <DialogDescription>
            {role
              ? "Update the role name and description. Screen access is managed in the Screen Permissions tab."
              : "Create a new role, then grant it screen access in the Screen Permissions tab."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance Head" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Finance review and budget approvals"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {role ? "Save changes" : "Create"}
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
  const { data: roleDefs, isLoading: rolesLoading } = useRoleDefs();
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);

  const key = (r: string, s: ScreenKey) => `${r}:${s}`;

  const current = useMemo(() => {
    if (draft) return draft;
    const m: Record<string, boolean> = {};
    for (const row of data ?? []) m[`${row.role_key}:${row.screen}`] = row.allowed;
    return m;
  }, [data, draft]);

  const roles = roleDefs ?? [];

  const save = useMutation({
    mutationFn: () => {
      const rows: RolePermissionRow[] = [];
      for (const r of roles)
        for (const s of SCREENS)
          rows.push({ role_key: r.key, screen: s.key, allowed: !!current[key(r.key, s.key)] });
      return saveFn({ data: { rows } });
    },
    onSuccess: () => {
      toast.success("Permissions saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["role-defs"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || rolesLoading) return <Skeleton className="h-72 w-full" />;

  const locked = (r: string, s: ScreenKey) => r === "admin" && s === "user_management";

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
              {roles.map((r) => (
                <tr key={r.key} className="border-t border-border/70 odd:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  {SCREENS.map((s) => (
                    <td key={s.key} className="px-3 py-3 text-center">
                      <Checkbox
                        checked={locked(r.key, s.key) ? true : !!current[key(r.key, s.key)]}
                        disabled={locked(r.key, s.key)}
                        onCheckedChange={(c) => setDraft({ ...current, [key(r.key, s.key)]: !!c })}
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
