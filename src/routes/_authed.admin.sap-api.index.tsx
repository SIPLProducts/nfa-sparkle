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
    system_id: "",
  });

  const { data, isLoading } = useQuery({ queryKey: ["sap-endpoints"], queryFn: () => list() });
  const listSystems = useServerFn(listSapSystems);
  const { data: systems } = useQuery({ queryKey: ["sap-systems"], queryFn: () => listSystems() });

  const createMut = useMutation({
    mutationFn: () => create({ data: { ...form, system_id: form.system_id || null } }),
    onSuccess: () => {
      toast.success("Endpoint registered");
      setOpen(false);
      setForm({ name: "", description: "", module: "Common", auth_type: "basic", path_or_url: "", system_id: "" });
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
              <Label>SAP system</Label>
              <Select
                value={form.system_id || "__active"}
                onValueChange={(v) => setForm({ ...form, system_id: v === "__active" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__active">Use active system</SelectItem>
                  {(systems ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label || s.key} ({s.environment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-path">Endpoint Path or URL</Label>
              <Input
                id="ep-path"
                placeholder="/e-nfa/enfa_report//create"
                value={form.path_or_url}
                onChange={(e) => setForm({ ...form, path_or_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use a relative path (starting with /) to inherit the host from{" "}
                <span className="font-medium text-foreground">SAP Systems</span> — the SAP client is appended
                automatically. A full http(s):// URL is also accepted.
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

function buildBaseUrl(s: { protocol: string; host: string; port: number; base_path: string }) {
  if (!s.host) return "";
  return `${s.protocol || "http"}://${s.host}${s.port ? `:${s.port}` : ""}${s.base_path || ""}`;
}

function parseBaseUrl(raw: string) {
  const value = raw.trim();
  const withProto = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  try {
    const u = new URL(withProto);
    return {
      protocol: u.protocol.replace(":", "") || "http",
      host: u.hostname,
      port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
      base_path: u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, ""),
    };
  } catch {
    return { protocol: "http", host: value, port: 8000, base_path: "" };
  }
}

const BLANK_SYSTEM = {
  id: undefined as string | undefined,
  key: "",
  label: "",
  environment: "DEV",
  base_url: "",
  sap_client: "300",
  username: "",
  route_via_middleware: true,
  notes: "",
  password: "",
};

function SystemsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSapSystems);
  const save = useServerFn(saveSapSystem);
  const activate = useServerFn(activateSapSystem);
  const remove = useServerFn(deleteSapSystem);
  const test = useServerFn(testSapSystem);

  const { data, isLoading } = useQuery({ queryKey: ["sap-systems"], queryFn: () => list() });
  const systems = data ?? [];

  const [form, setForm] = useState(BLANK_SYSTEM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const current = systems.find((s) => s.id === selectedId) ?? null;

  function load(s: SapSystem) {
    setSelectedId(s.id);
    setForm({
      id: s.id,
      key: s.key,
      label: s.label,
      environment: s.environment,
      base_url: buildBaseUrl(s),
      sap_client: s.sap_client,
      username: s.username,
      route_via_middleware: s.route_via_middleware,
      notes: s.notes ?? "",
      password: "",
    });
  }

  useEffect(() => {
    if (loaded || !data) return;
    const active = data.find((s) => s.is_active) ?? data[0];
    if (active) load(active);
    setLoaded(true);
  }, [data, loaded]);

  const saveMut = useMutation({
    mutationFn: () => {
      const parsed = parseBaseUrl(form.base_url);
      const sapClient = form.sap_client.trim() || "300";
      return save({
        data: {
          id: form.id,
          key: form.key.trim() || `${form.environment}${sapClient}`,
          label: form.label.trim() || `SAP ${form.environment}`,
          environment: form.environment,
          protocol: parsed.protocol,
          host: parsed.host,
          port: parsed.port,
          sap_client: sapClient,
          base_path: parsed.base_path,
          username: form.username,
          route_via_middleware: true,
          notes: form.notes,
          password: form.password,
        },
      });
    },
    onSuccess: async () => {
      toast.success(form.id ? "SAP connection saved" : "SAP system added");
      setForm((f) => ({ ...f, password: "" }));
      const fresh = await qc.invalidateQueries({ queryKey: ["sap-systems"] });
      return fresh;
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
    onSuccess: (_r, id) => {
      toast.success("System removed");
      if (id === selectedId) {
        setSelectedId(null);
        setForm(BLANK_SYSTEM);
        setLoaded(false);
      }
      qc.invalidateQueries({ queryKey: ["sap-systems"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest(id: string, label: string) {
    setTesting(true);
    try {
      resultToast(await test({ data: { id } }), label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        icon={Database}
        title="SAP Connection"
        description="Base URL and technical-user credentials for the active SAP system. Endpoints that store a relative path (e.g. /sd_approval_mng/...) inherit this Base URL automatically — switching DEV → Quality is a one-field change."
        action={
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={!form.id || testing}
            onClick={() => form.id && runTest(form.id, form.label || form.key)}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Test connection
          </Button>
        }
      >
        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="sys-url">SAP Base URL</Label>
                <Input
                  id="sys-url"
                  placeholder="http://10.150.150.154:8103"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
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
                  SAP Password <SetBadge set={!!current?.has_password} />
                </Label>
                <Input
                  id="sys-pass"
                  type="password"
                  placeholder={current?.has_password ? "•••••••• (leave blank to keep)" : "Enter password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {form.id && (
                <Button
                  variant="ghost"
                  className="gap-2 mr-auto"
                  onClick={() => {
                    setSelectedId(null);
                    setForm(BLANK_SYSTEM);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add another system
                </Button>
              )}
              <Button
                className="gap-2"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.base_url.trim()}
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save SAP connection
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      {systems.length > 1 && (
        <SectionCard
          icon={Server}
          title="Registered SAP systems"
          description="One system is Active at a time — endpoints with a relative path use it automatically. Select a row to edit it above."
        >
          <div className="divide-y divide-border rounded-lg border border-border">
            {systems.map((s) => (
              <div
                key={s.id}
                className={
                  "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between " +
                  (s.id === selectedId ? "bg-muted/50" : "")
                }
              >
                <button type="button" className="min-w-0 text-left" onClick={() => load(s)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{s.label || s.key}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                      {s.environment}
                    </Badge>
                    {s.is_active && (
                      <Badge className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {buildBaseUrl(s)}
                    {s.sap_client ? `  ·  sap-client=${s.sap_client}` : ""}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-2">
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
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load(s)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={testing}
                    onClick={() => runTest(s.id, s.label || s.key)}
                  >
                    <Activity className="h-3.5 w-3.5" /> Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${s.label || s.key}`}
                    title="Delete system"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmId(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

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
    </div>
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
