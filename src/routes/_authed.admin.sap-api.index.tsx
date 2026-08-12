import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plug,
  Database,
  Server,
  Plus,
  Pencil,
  Activity,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SAP_AUTH_TYPES,
  SAP_ENVIRONMENTS,
  SAP_MODULES,
  CONNECTION_MODES,
  DEPLOYMENT_MODES,
} from "@/lib/sap-api-constants";
import {
  createSapEndpoint,
  deleteSapEndpoint,
  getSapSettings,
  listSapEndpoints,
  saveMiddlewareConfig,
  testMiddleware,
  testSapEndpoint,
  listSapSystems,
  saveSapSystem,
  activateSapSystem,
  deleteSapSystem,
  testSapSystem,
  type SapSystem,
  type TestResult,
} from "@/lib/sap-api.functions";

export const Route = createFileRoute("/_authed/admin/sap-api/")({
  head: () => ({
    meta: [
      { title: "SAP API Settings — NFA Portal" },
      { name: "description", content: "Register SAP/REST endpoints and configure the shared Node.js middleware." },
      { property: "og:title", content: "SAP API Settings — NFA Portal" },
      { property: "og:description", content: "Register SAP/REST endpoints and configure the shared Node.js middleware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SapApiSettings,
});

function resultToast(r: TestResult, label: string) {
  if (r.ok) toast.success(`${label} OK · ${r.status} · ${r.latencyMs} ms`);
  else toast.error(`${label} failed${r.status ? ` · ${r.status}` : ""}${r.error ? ` · ${r.error}` : ""}`);
}

function SapApiSettings() {
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
        title="SAP API Settings"
        subtitle="Register dynamic SAP/REST endpoints and configure the shared Node.js middleware."
      />
      <Tabs defaultValue="apis" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="apis" className="gap-2">
            <Plug className="h-4 w-4" /> APIs
          </TabsTrigger>
          <TabsTrigger value="connection" className="gap-2">
            <Database className="h-4 w-4" /> SAP Systems
          </TabsTrigger>
          <TabsTrigger value="middleware" className="gap-2">
            <Server className="h-4 w-4" /> Middleware Configuration
          </TabsTrigger>
        </TabsList>
        <TabsContent value="apis" className="mt-0">
          <EndpointsTab />
        </TabsContent>
        <TabsContent value="connection" className="mt-0">
          <SystemsTab />
        </TabsContent>
        <TabsContent value="middleware" className="mt-0">
          <MiddlewareTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- APIs tab ------------------------------- */

function EndpointsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSapEndpoints);
  const create = useServerFn(createSapEndpoint);
  const remove = useServerFn(deleteSapEndpoint);
  const test = useServerFn(testSapEndpoint);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    module: "Common",
    auth_type: "basic",
    path_or_url: "",
  });

  const { data, isLoading } = useQuery({ queryKey: ["sap-endpoints"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Endpoint registered");
      setOpen(false);
      setForm({ name: "", description: "", module: "Common", auth_type: "basic", path_or_url: "" });
      qc.invalidateQueries({ queryKey: ["sap-endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Endpoint deleted");
      qc.invalidateQueries({ queryKey: ["sap-endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest(id: string, name: string) {
    setTestingId(id);
    try {
      resultToast(await test({ data: { id } }), name);
      qc.invalidateQueries({ queryKey: ["sap-endpoints"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New endpoint
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Plug className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No endpoints registered yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first SAP endpoint to start wiring up the integration.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New endpoint
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((ep) => (
            <div
              key={ep.id}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/admin/sap-api/$id"
                    params={{ id: ep.id }}
                    className="block truncate font-semibold tracking-tight hover:underline"
                  >
                    {ep.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ep.description || "—"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    {ep.module}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {ep.auth_type}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium " +
                    (ep.active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {ep.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {ep.active ? "Active" : "Inactive"}
                </span>
                <span className="text-muted-foreground">
                  {ep.last_synced_at ? `Synced ${new Date(ep.last_synced_at).toLocaleString()}` : "Never synced"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/admin/sap-api/$id" params={{ id: ep.id }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={testingId === ep.id}
                  onClick={() => runTest(ep.id, ep.name)}
                >
                  {testingId === ep.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Activity className="h-3.5 w-3.5" />
                  )}
                  Test
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${ep.name}`}
                  title="Delete endpoint"
                  className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmId(ep.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register a new SAP endpoint</DialogTitle>
            <DialogDescription>Define the endpoint now — request details can be tuned afterwards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-name">Name</Label>
              <Input
                id="ep-name"
                placeholder="e.g. PR_GET"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-desc">Description</Label>
              <Textarea
                id="ep-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAP_MODULES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Auth type</Label>
                <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAP_AUTH_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-path">Endpoint Path or URL</Label>
              <Input
                id="ep-path"
                placeholder="/sd_approval_mng/zvk11_app/vk11_app?sap-client=300"
                value={form.path_or_url}
                onChange={(e) => setForm({ ...form, path_or_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use a relative path (starting with /) to inherit the SAP Base URL from{" "}
                <span className="font-medium text-foreground">SAP Connection</span>. A full https:// URL is also
                accepted.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name.trim()}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              The endpoint definition and its stored credentials will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) deleteMut.mutate(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* --------------------------- SAP Connection tab --------------------------- */

function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof Database;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <Icon className="h-5 w-5 text-muted-foreground" /> {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function SetBadge({ set }: { set: boolean }) {
  if (!set) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <ShieldCheck className="h-3 w-3" /> set
    </span>
  );
}

function SystemsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSapSystems);
  const save = useServerFn(saveSapSystem);
  const activate = useServerFn(activateSapSystem);
  const remove = useServerFn(deleteSapSystem);
  const test = useServerFn(testSapSystem);

  const { data, isLoading } = useQuery({ queryKey: ["sap-systems"], queryFn: () => list() });
  const [editing, setEditing] = useState<SapSystem | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const blank = {
    id: undefined as string | undefined,
    key: "",
    label: "",
    environment: "DEV",
    protocol: "http",
    host: "",
    port: 8000,
    sap_client: "300",
    base_path: "",
    username: "",
    route_via_middleware: true,
    notes: "",
    password: "",
  };
  const [form, setForm] = useState(blank);

  function openNew() {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  }

  function openEdit(s: SapSystem) {
    setEditing(s);
    setForm({
      id: s.id,
      key: s.key,
      label: s.label,
      environment: s.environment,
      protocol: s.protocol,
      host: s.host,
      port: s.port,
      sap_client: s.sap_client,
      base_path: s.base_path,
      username: s.username,
      route_via_middleware: s.route_via_middleware,
      notes: s.notes ?? "",
      password: "",
    });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success(editing ? "System updated" : "System added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sap-systems"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => activate({ data: { id } }),
    onSuccess: () => {
      toast.success("Active SAP system switched");
      qc.invalidateQueries({ queryKey: ["sap-systems"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("System removed");
      qc.invalidateQueries({ queryKey: ["sap-systems"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest(s: SapSystem) {
    setTestingId(s.id);
    try {
      resultToast(await test({ data: { id: s.id } }), s.label || s.key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  const systems = data ?? [];

  return (
    <SectionCard
      icon={Database}
      title="SAP Systems"
      description="Register every SAP system you integrate with (DEV / Quality / Production). One system is Active at a time — endpoints with a relative path use the Active system automatically, so moving to another SAP host is just an IP change here. No code changes, no redeploy."
      action={
        <Button className="gap-2 shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add SAP system
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : systems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No SAP systems yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first system — e.g. host <span className="font-mono">10.200.1.2</span>, port{" "}
            <span className="font-mono">8000</span>, client <span className="font-mono">300</span>.
          </p>
          <Button className="mt-4 gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add SAP system
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {systems.map((s) => (
            <div
              key={s.id}
              className={
                "rounded-lg border bg-card p-4 shadow-sm transition " +
                (s.is_active ? "border-primary/60 ring-1 ring-primary/20" : "border-border")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold tracking-tight">{s.label || s.key}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                      {s.environment}
                    </Badge>
                    {s.is_active && (
                      <Badge className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {s.protocol}://{s.host}
                    {s.port ? `:${s.port}` : ""}
                    {s.base_path}
                    {s.sap_client ? `  ·  sap-client=${s.sap_client}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Key <span className="font-mono">{s.key}</span> · user{" "}
                    <span className="font-mono">{s.username || "—"}</span> <SetBadge set={s.has_password} /> ·{" "}
                    {s.route_via_middleware ? "via middleware" : "direct"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                {!s.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => activateMut.mutate(s.id)}
                    disabled={activateMut.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Make active
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={testingId === s.id}
                  onClick={() => runTest(s)}
                >
                  {testingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Activity className="h-3.5 w-3.5" />
                  )}
                  Test
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${s.label || s.key}`}
                  title="Delete system"
                  className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmId(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit SAP system" : "Add SAP system"}</DialogTitle>
            <DialogDescription>
              The app builds the base URL from these fields and always appends the SAP client.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sys-key">System key</Label>
              <Input
                id="sys-key"
                placeholder="DEV300"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Must match the key in the middleware systems.json.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-label">Label</Label>
              <Input
                id="sys-label"
                placeholder="SAP Development (client 300)"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAP_ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Protocol</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">http</SelectItem>
                  <SelectItem value="https">https</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-host">SAP Host / IP</Label>
              <Input
                id="sys-host"
                placeholder="10.200.1.2"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-port">Port</Label>
              <Input
                id="sys-port"
                inputMode="numeric"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-client">SAP Client</Label>
              <Input
                id="sys-client"
                placeholder="300"
                value={form.sap_client}
                onChange={(e) => setForm({ ...form, sap_client: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-basepath">Base path (optional)</Label>
              <Input
                id="sys-basepath"
                placeholder="/sap/bc"
                value={form.base_path}
                onChange={(e) => setForm({ ...form, base_path: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-user">SAP Username</Label>
              <Input
                id="sys-user"
                placeholder="sipl_qm"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sys-pass" className="flex items-center gap-2">
                SAP Password <SetBadge set={!!editing?.has_password} />
              </Label>
              <Input
                id="sys-pass"
                type="password"
                placeholder={editing?.has_password ? "•••••••• (leave blank to keep)" : "Enter password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Routing</Label>
              <Select
                value={form.route_via_middleware ? "proxy" : "direct"}
                onValueChange={(v) => setForm({ ...form, route_via_middleware: v === "proxy" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proxy">Route via local middleware (ngrok)</SelectItem>
                  <SelectItem value="direct">Call SAP directly from the cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sys-notes">Notes</Label>
              <Textarea
                id="sys-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.key.trim() || !form.host.trim()}
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Save system" : "Add system"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this SAP system?</AlertDialogTitle>
            <AlertDialogDescription>
              Endpoints pinned to it will fall back to the active system. Stored credentials are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) deleteMut.mutate(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

/* ---------------------------- Middleware tab ---------------------------- */

function MiddlewareTab() {
  const qc = useQueryClient();
  const get = useServerFn(getSapSettings);
  const save = useServerFn(saveMiddlewareConfig);
  const test = useServerFn(testMiddleware);
  const { data, isLoading } = useQuery({ queryKey: ["sap-settings"], queryFn: () => get() });
  const [form, setForm] = useState({
    connection_mode: "proxy",
    deployment_mode: "lovable_cloud",
    port: 3005,
    url: "",
    secret: "",
  });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data)
      setForm({
        connection_mode: data.middleware.connection_mode,
        deployment_mode: data.middleware.deployment_mode,
        port: data.middleware.port,
        url: data.middleware.url,
        secret: "",
      });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("Middleware settings saved");
      setForm((f) => ({ ...f, secret: "" }));
      qc.invalidateQueries({ queryKey: ["sap-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-72 w-full rounded-lg" />;

  return (
    <SectionCard
      icon={Server}
      title="Node.js Middleware"
      description="These settings are shared by every SAP API integration whose Auth Type is set to Proxy / Middleware."
      action={
        <Button
          variant="outline"
          className="gap-2 shrink-0"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            try {
              resultToast(await test(), "Middleware");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Test failed");
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Test middleware
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Connection Mode</Label>
          <Select value={form.connection_mode} onValueChange={(v) => setForm({ ...form, connection_mode: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONNECTION_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Deployment Mode</Label>
          <Select value={form.deployment_mode} onValueChange={(v) => setForm({ ...form, deployment_mode: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPLOYMENT_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mw-port">Middleware Port</Label>
          <Input
            id="mw-port"
            inputMode="numeric"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mw-url">
            Node.js Middleware URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="mw-url"
            placeholder="https://middleware.example.com"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="mw-secret" className="flex items-center gap-2">
            Proxy Secret / Password <span className="text-destructive">*</span>
            <SetBadge set={!!data?.middleware.has_secret} />
          </Label>
          <Input
            id="mw-secret"
            type="password"
            placeholder={data?.middleware.has_secret ? "•••••••• (leave blank to keep)" : "Enter secret"}
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          middleware settings
        </Button>
      </div>
    </SectionCard>
  );
}
