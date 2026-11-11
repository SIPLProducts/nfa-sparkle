import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { swalConfirm, toast } from "@/lib/swal";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Save,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { GitBranch, Building2, BadgeCheck } from "lucide-react";
import { MasterListTab } from "@/components/admin/MasterListTab";
import { RangeTab, seriesQueryKey } from "@/components/admin/RangeTab";
import { listCompanySeries } from "@/lib/company-series.functions";
import { ApprovalChainTab } from "@/components/admin/ApprovalChainTab";
import { DynamicApproversTab } from "@/components/admin/DynamicApproversTab";
import { useScreenEntryEffect } from "@/hooks/use-screen-entry-effect";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { listMasterItems } from "@/lib/master-lists.functions";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SCREENS, type Role, type ScreenKey } from "@/lib/screens";
import {
  createRoleDef,
  deleteManagedUser,
  deleteRoleDef,
  listManagedUsers,
  listRoleDefs,
  listRolePermissions,
  resetManagedUserPassword,
  saveRolePermissions,
  updateManagedUser,
  updateRoleDef,
  type CreateUserPayload,
  type UpdateUserPayload,
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
  return useQuery({ queryKey: ["role-defs"], queryFn: () => fetchRoles(), staleTime: 60_000, refetchOnMount: "always" });
}

function UserManagement() {
  const { canAccess } = useAuth();
  const qc = useQueryClient();
  const hasAccess = canAccess("user_management");
  const [tab, setTab] = useState("users");

  // Navigating into this screen refreshes its data once; switching the tabs
  // inside the screen reuses the cache and never refetches.
  useScreenEntryEffect("/admin/users", () => {
    setTab("users");
    const keys = ["managed-users", "role-defs", "role-permissions", "approval-chains"];
    keys.forEach((k) => qc.resetQueries({ queryKey: [k], exact: false }));
    return () => keys.forEach((k) => qc.removeQueries({ queryKey: [k], exact: false }));
  }, hasAccess);

  if (!hasAccess) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="User Management"
        subtitle="Create users, assign roles and decide which screens each role can open."
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="users" className="gap-2">
            <UserCog className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="designations" className="gap-2">
            <BadgeCheck className="h-4 w-4" /> Designations
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" /> Companies
          </TabsTrigger>
          <TabsTrigger value="perms" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Screen Permissions
          </TabsTrigger>
          <TabsTrigger value="chain" className="gap-2">
            <GitBranch className="h-4 w-4" /> Approval Chain
          </TabsTrigger>
          <TabsTrigger value="dynamic" className="gap-2">
            <GitBranch className="h-4 w-4" /> Dynamic Approvers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="departments">
          <MasterListTab kind="departments" singular="Department" nameLabel="Department Name" showCode={false} showActive={false} />
        </TabsContent>
        <TabsContent value="designations">
          <MasterListTab kind="designations" singular="Designation" nameLabel="Designation Name" showCode={false} showActive={false} />
        </TabsContent>
        <TabsContent value="companies">
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList>
              <TabsTrigger value="list">Companies</TabsTrigger>
              <TabsTrigger value="range">Range</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
              <MasterListTab kind="companies" singular="Company" nameLabel="Company Name" showCode={true} codeLabel="Company Code" descriptionLabel="Company Description" showActive={false} />
            </TabsContent>
            <TabsContent value="range">
              <RangeTab />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="perms">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="chain">
          <ApprovalChainTab />
        </TabsContent>
        <TabsContent value="dynamic">
          <DynamicApproversTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- users -------------------------------- */

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  const { data: roleDefs, isLoading } = useRoleDefs();
  const [open, setOpen] = useState(false);
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  const roles = roleDefs ?? [];
  const nameOf = (k: Role) => roles.find((r) => r.key === k)?.name ?? k;
  const toggle = (k: Role) => onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <span className="flex flex-1 flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">Select roles</span>
            ) : (
              value.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1 pr-1">
                  {nameOf(k)}
                  <span
                    role="button"
                    aria-label={`Remove ${nameOf(k)}`}
                    className="rounded-sm px-0.5 hover:bg-muted-foreground/20"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); toggle(k); }}
                  >
                    ×
                  </span>
                </Badge>
              ))
            )}
          </span>
          <span className="text-muted-foreground">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search roles..." />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem key={role.key} value={role.name} onSelect={() => toggle(role.key)} className="gap-2">
                  <Checkbox checked={value.includes(role.key)} className="pointer-events-none" />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Dropdown fed by the Departments / Designations tabs (active entries, by name). */
function MasterSelect({
  kind,
  value,
  onChange,
  invalid,
}: {
  kind: "departments" | "designations";
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const noun = kind === "departments" ? "department" : "designation";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["master-select", kind],
    queryFn: () => listMasterItems({ data: { kind } }),
    staleTime: 0,
    refetchOnMount: "always",
  });
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  const names = Array.from(
    new Set((data ?? []).filter((r) => r.is_active && r.name?.trim()).map((r) => r.name.trim())),
  ).sort((a, b) => a.localeCompare(b));
  // Keep a previously saved value selectable even if it is no longer in the list.
  const options = value && !names.includes(value) ? [value, ...names] : names;
  const label = kind === "departments" ? "Departments" : "Designations";
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger aria-invalid={invalid}>
        <SelectValue placeholder={`Select a ${noun}`} />
      </SelectTrigger>
      <SelectContent>
        {options.length ? (
          options.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            {isError ? `Could not load ${noun}s.` : `No ${noun}s yet — add them in the ${label} tab.`}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listManagedUsers);
  const { data: roleDefs } = useRoleDefs();
  const roleName = (k: string) => roleDefs?.find((r) => r.key === k)?.name ?? k;
  const updateFn = useServerFn(updateManagedUser);
  const resetFn = useServerFn(resetManagedUserPassword);
  const deleteUserFn = useServerFn(deleteManagedUser);

  const { data, isLoading } = useQuery({ queryKey: ["managed-users"], queryFn: () => fetchUsers(), staleTime: 60_000, refetchOnMount: "always" });
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
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.username ?? "").toLowerCase().includes(term) ||
        (u.employee_id ?? "").toLowerCase().includes(term) ||
        (u.company_code ?? "").toLowerCase().includes(term) ||
        (u.department ?? "").toLowerCase().includes(term) ||
        (u.contact ?? "").toLowerCase().includes(term) ||
        (u.full_name ?? "").toLowerCase().includes(term),
    );
  }, [data, q]);

  const deleteUser = useMutation({
    mutationFn: (id: string) => deleteUserFn({ data: { id } }),
    onSuccess: () => {
      toast.success("User deleted successfully");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, User ID or email…"
            className="pl-9"
          />
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
            <table className="w-full min-w-[1280px] table-fixed text-sm">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[130px]" />
                <col className="w-[210px]" />
                <col className="w-[210px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col className="w-[160px]" />
              </colgroup>
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="bg-muted/60">
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">User ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Company</th>
                  <th className="px-4 py-2.5 text-left font-medium">Department</th>
                  <th className="px-4 py-2.5 text-left font-medium">Designation</th>
                  <th className="px-4 py-2.5 text-left font-medium">Contact</th>
                  <th className="px-4 py-2.5 text-left font-medium">Roles</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Created</th>
                  <th className="px-4 py-2.5 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/70 odd:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      <div className="break-words">{u.full_name || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      <div className="break-words">{u.username || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="break-all">{u.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.company_code || u.employee_id ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">{u.company_code || "—"}</div>
                          <div className="break-words text-xs">{u.employee_id || "—"}</div>
                          {u.company_series ? <div className="text-xs">Series: {u.company_series}</div> : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="break-words">{u.department || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="break-words">{u.designation || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{u.contact || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="capitalize">
                            {roleName(r)}
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
                      <div className="flex flex-nowrap items-center justify-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Edit" aria-label="Edit" onClick={() => setEditing(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          title="Reset password"
                          aria-label="Reset password"
                          onClick={() => setPwUser(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8 shrink-0"
                          title="Delete"
                          aria-label="Delete"
                          disabled={deleteUser.isPending}
                          onClick={async () => {
                            const confirmed = await swalConfirm({
                              title: "Are you sure you want to delete this user?",
                              text: "This action permanently deletes the selected user.",
                              confirmText: "Delete",
                              destructive: true,
                            });
                            if (confirmed) deleteUser.mutate(u.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("Sign in again before creating a user");

          const response = await fetch("/api/public/create-user", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(v),
          });
          const result = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; message?: string; error?: string };
          if (!response.ok || result.ok === false) {
            throw new Error(result.error ?? "Create user failed");
          }
          toast.success(result.message ?? "User created successfully");
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

/** Company list from the web Company Master (User Management → Companies). */
function useCompanyOptions(enabled: boolean) {
  const [options, setOptions] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const rows = await listMasterItems({ data: { kind: "companies" } });
        const list = rows
          .filter((r) => r.is_active && (r.code ?? "").trim())
          .map((r) => ({ code: (r.code ?? "").trim(), name: r.name }));
        if (cancelled) return;
        setOptions(list);
        setError(list.length ? "" : "No companies in Company Master");
      } catch {
        if (!cancelled) {
          setOptions([]);
          setError("Could not load companies.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, reload]);

  return { options, loading, error, retry: () => setReload((n) => n + 1) };
}

function CompanyNameField({
  companyCode,
  onChange,
  companies,
  required,
  error,
}: {
  required?: boolean;
  error?: boolean;
  companyCode: string;
  onChange: (code: string, name: string) => void;
  companies: ReturnType<typeof useCompanyOptions>;
}) {
  const [open, setOpen] = useState(false);
  const selected = companies.options.find((c) => c.code === companyCode);
  const placeholder = companies.loading ? "Loading companies…" : "Select a company";

  return (
    <div className="space-y-1.5">
      <Label>
        {required ? "Company" : "Company Name"}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={error}
            className={cn("w-full justify-between font-normal", error && "border-destructive")}
            disabled={companies.loading || !companies.options.length}
          >
            <span className="truncate">
              {selected ? `${selected.code} – ${selected.name}` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(value, search) => {
              const term = search.toLowerCase();
              return value.toLowerCase().includes(term) ? 1 : 0;
            }}
          >
            <CommandInput />
            <CommandList>
              <CommandEmpty>No company found.</CommandEmpty>
              <CommandGroup>
                {companies.options.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} – ${c.name}`}
                    onSelect={() => {
                      onChange(c.code, c.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        companyCode === c.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.code} – {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? <p className="text-xs text-destructive">Company is required</p> : null}
      {companies.error ? (
        <p className="text-xs text-destructive">
          {companies.error}{" "}
          <button type="button" className="underline" onClick={companies.retry}>
            Retry
          </button>
        </p>
      ) : null}
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
  onSubmit: (v: CreateUserPayload) => Promise<void>;

}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyError, setCompanyError] = useState(false);
  const [series, setSeries] = useState("");
  const [department, setDepartment] = useState("");
  const [deptError, setDeptError] = useState(false);
  const [designation, setDesignation] = useState("");
  const [desigError, setDesigError] = useState(false);
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const companies = useCompanyOptions(open);

  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmployeeId("");
      setCompanyCode("");
      setCompanyError(false);
      setSeries("");
      setDepartment("");
      setDeptError(false);
      setDesignation("");
      setDesigError(false);
      setContact("");
      setStatus("ACTIVE");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setRole([]);
    }
  }, [open]);

  const closeDialog = () => onOpenChange(false);

  const submit = async () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!role.length) {
      toast.error("Select at least one role");
      return;
    }
    if (!companyCode) {
      setCompanyError(true);
      toast.error("Company is required");
      return;
    }
    if (!department.trim()) {
      setDeptError(true);
      toast.error("Department is required");
      return;
    }
    if (!designation.trim()) {
      setDesigError(true);
      toast.error("Designation is required");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        USER_ID: username,
        FIRST_NAME: firstName,
        LAST_NAME: lastName,
        EMAIL: email,
        STATUS: status,
        CONTACT: contact,
        PASSWORD: password,
        CONFPWRD: confirmPassword,
        ROLE: role.join(","),
        EMP_ID: employeeId,
        COMPANY_CODE: companyCode,
        SERIES: series,
        DEPT: department,
        DESIG: designation,
      });

    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const req = <span className="text-destructive">*</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4" role="presentation">
      <div
        aria-labelledby="create-user-title"
        aria-modal="true"
        className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        role="dialog"
      >
        <Button
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 p-0"
          onClick={closeDialog}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 border-b px-5 py-4 pr-12 sm:px-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Plus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="create-user-title" className="text-lg font-semibold leading-tight tracking-tight">
              Create user
            </h2>
            <p className="text-sm text-muted-foreground">The account is confirmed immediately and can sign in right away.</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>User ID {req}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={12}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Used to sign in. Up to 12 characters: letters, numbers, dot, underscore or hyphen.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Status {req}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>First name {req}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name {req}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email {req}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact {req}</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-semibold">Company</p>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <CompanyNameField
              companies={companies}
              companyCode={companyCode}
              required
              error={companyError}
              onChange={(code, name) => {
                setCompanyError(false);
                setCompanyCode(code);
                setEmployeeId(name);
              }}
            />
                <div className="space-y-1.5">
                  <Label>Series</Label>
                  <SeriesSelect value={series} onChange={setSeries} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Department {req}</Label>
              <MasterSelect
                kind="departments"
                value={department}
                onChange={(v) => {
                  setDepartment(v);
                  if (v.trim()) setDeptError(false);
                }}
                invalid={deptError}
              />
              {deptError && <p className="text-xs text-destructive">Department is required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Designation {req}</Label>
              <MasterSelect
                kind="designations"
                value={designation}
                onChange={(v) => {
                  setDesignation(v);
                  if (v.trim()) setDesigError(false);
                }}
                invalid={desigError}
              />
              {desigError && <p className="text-xs text-destructive">Designation is required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role {req}</Label>
              <RolePicker value={role} onChange={setRole} />
            </div>
            <div className="space-y-1.5">
              <Label>Password {req}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password {req}</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="w-full gap-2 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create user
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSubmit: (v: UpdateUserPayload) => Promise<void>;

}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [series, setSeries] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [role, setRole] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const companies = useCompanyOptions(!!user);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setUsername(user.username ?? "");
      setEmail(user.email ?? "");
      setEmployeeId(user.employee_id ?? "");
      setCompanyCode(user.company_code ?? "");
      setSeries(user.company_series ?? "");
      setDepartment(user.department ?? "");
      setDesignation(user.designation ?? "");
      setContact(user.contact ?? "");
      setStatus(user.status ?? (user.is_active ? "ACTIVE" : "INACTIVE"));
      setRole(user.roles ?? []);
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!role.length) {
      toast.error("Select at least one role");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        ID: user.id,
        USER_ID: username,
        FIRST_NAME: firstName,
        LAST_NAME: lastName,
        EMAIL: email,
        STATUS: status,
        CONTACT: contact,
        ROLE: role.join(","),
        EMP_ID: employeeId,
        COMPANY_CODE: companyCode,
        SERIES: series,
        DEPT: department,
        DESIG: designation,
      });

      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const req = <span className="text-destructive">*</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4" role="presentation">
      <div
        aria-labelledby="edit-user-title"
        aria-modal="true"
        className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        role="dialog"
      >
        <Button aria-label="Close" className="absolute right-3 top-3 h-8 w-8 p-0" onClick={onClose} size="icon" type="button" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 border-b px-5 py-4 pr-12 sm:px-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Save className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="edit-user-title" className="text-lg font-semibold leading-tight tracking-tight">Edit user</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>User ID {req}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Status {req}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>First name {req}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name {req}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email {req}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact {req}</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-semibold">Company</p>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <CompanyNameField
              companies={companies}
              companyCode={companyCode}
              onChange={(code, name) => {
                setCompanyCode(code);
                setEmployeeId(name);
              }}
            />
                <div className="space-y-1.5">
                  <Label>Series</Label>
                  <SeriesSelect value={series} onChange={setSeries} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <MasterSelect kind="departments" value={department} onChange={setDepartment} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <MasterSelect kind="designations" value={designation} onChange={setDesignation} />
            </div>
            <div className="space-y-1.5">
              <Label>Role {req}</Label>
              <RolePicker value={role} onChange={setRole} />
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="w-full gap-2 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </div>
      </div>
    </div>
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
  const customRoles = data ?? [];
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
      <p className="text-sm text-muted-foreground">Roles decide which screens a user can open.</p>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create role
        </Button>
      </div>
      <RoleTable
        roles={customRoles}
        removePending={remove.isPending}
        onEdit={setEditing}
        onDelete={async (role) => {
          const confirmed = await swalConfirm({
            title: "Delete this role?",
            text: "The role and its screen permissions will be removed. This cannot be undone.",
            confirmText: "Delete",
            destructive: true,
          });
          if (confirmed) remove.mutate(role.key);
        }}
      />

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

function RoleTable({
  roles,
  removePending = false,
  onEdit,
  onDelete,
}: {
  roles: RoleDef[];
  removePending?: boolean;
  onEdit?: (role: RoleDef) => void;
  onDelete?: (role: RoleDef) => Promise<void>;
}) {
  return (
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
            {roles.length === 0 ? (
              <tr className="border-t border-border/70">
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No roles found.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.key} className="border-t border-border/70 odd:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role.description || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{role.user_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {role.screen_count} / {SCREENS.length}
                  </td>
                  <td className="px-4 py-3">
                    {onEdit && onDelete ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          title="Edit role"
                          onClick={() => onEdit(role)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive"
                          disabled={removePending}
                          title="Delete role"
                          onClick={() => void onDelete(role)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
  const { data, isLoading } = useQuery({ queryKey: ["role-permissions"], queryFn: () => fetchPerms(), staleTime: 60_000, refetchOnMount: "always" });
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

  const locked = (r: string, s: ScreenKey) => r === "custom_admin" && s === "user_management";

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

function SeriesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const listFn = useServerFn(listCompanySeries);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: seriesQueryKey, queryFn: () => listFn(), staleTime: 0 });
  const rows = data ?? [];
  const NONE = "__none__";
  return (
    <>
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading series…" : "Select a series"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{isLoading ? "Loading series…" : "No series"}</SelectItem>
        {value && !rows.some((r) => r.series === value) ? <SelectItem value={value}>{value}</SelectItem> : null}
        {rows.map((r) => (
          <SelectItem key={r.id} value={r.series}>
            {r.series} ({r.range_from}–{r.range_to})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {isError ? (
      <p className="text-xs text-destructive">
        Could not load series.{" "}
        <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
      </p>
    ) : null}
    </>
  );
}
