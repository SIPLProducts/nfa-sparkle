import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Activity, Loader2, Save, Plus, X, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SAP_API_TYPES, SAP_AUTH_TYPES, SAP_METHODS, SAP_MODULES, CREATE_BODY_SAMPLE } from "@/lib/sap-api-constants";
import {
  getSapEndpoint,
  listSapTestLog,
  listSapSystems,
  testSapEndpoint,
  updateSapEndpoint,
  type SapEndpoint,
  type TestResult,
} from "@/lib/sap-api.functions";

export const Route = createFileRoute("/_authed/admin/sap-api/$id")({
  head: () => ({
    meta: [
      { title: "SAP Endpoint — NFA Portal" },
      { name: "description", content: "Configure request, response, credentials and scheduling for a SAP endpoint." },
      { property: "og:title", content: "SAP Endpoint — NFA Portal" },
      { property: "og:description", content: "Configure request, response, credentials and scheduling for a SAP endpoint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EndpointDetail,
});

type KV = { key: string; value: string };
const toKV = (o: Record<string, string> | null | undefined): KV[] =>
  Object.entries(o ?? {}).map(([key, value]) => ({ key, value }));
const fromKV = (rows: KV[]) =>
  Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));

function KVEditor({ rows, onChange, label }: { rows: KV[]; onChange: (r: KV[]) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">None defined.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Name"
            value={r.key}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
          />
          <Input
            placeholder="Value"
            value={r.value}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove row"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

function EndpointDetail() {
  const { id } = Route.useParams();
  const { hasRole, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isAdmin = hasRole("admin");

  const get = useServerFn(getSapEndpoint);
  const update = useServerFn(updateSapEndpoint);
  const test = useServerFn(testSapEndpoint);
  const logs = useServerFn(listSapTestLog);

  const [ep, setEp] = useState<SapEndpoint | null>(null);
  const [password, setPassword] = useState("");
  const [headers, setHeaders] = useState<KV[]>([]);
  const [query, setQuery] = useState<KV[]>([]);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admins only");
      nav({ to: "/", replace: true });
    }
  }, [loading, isAdmin, nav]);

  const { data, isLoading } = useQuery({
    queryKey: ["sap-endpoint", id],
    queryFn: () => get({ data: { id } }),
    enabled: isAdmin,
    refetchOnMount: "always",
  });
  const { data: history } = useQuery({
    queryKey: ["sap-endpoint-log", id],
    queryFn: () => logs({ data: { endpointId: id } }),
    enabled: isAdmin,
    refetchOnMount: "always",
  });
  const listSystems = useServerFn(listSapSystems);
  const { data: systems } = useQuery({
    queryKey: ["sap-systems"],
    queryFn: () => listSystems(),
    enabled: isAdmin,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (data) {
      setEp(data);
      setHeaders(toKV(data.request_headers));
      setQuery(toKV(data.request_query));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          id,
          patch: {
            name: ep!.name,
            description: ep!.description,
            module: ep!.module,
            path_or_url: ep!.path_or_url,
            http_method: ep!.http_method,
            auth_type: ep!.auth_type,
            api_type: ep!.api_type,
            active: ep!.active,
            username: ep!.username,
            system_id: ep!.system_id || null,
            request_headers: fromKV(headers),
            request_query: fromKV(query),
            request_body: ep!.request_body,
            schedule_enabled: ep!.schedule_enabled,
            schedule_cron: ep!.schedule_cron,
          },
          password: password || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["sap-endpoint", id] });
      qc.invalidateQueries({ queryKey: ["sap-endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest() {
    setTesting(true);
    try {
      const r = await test({ data: { id } });
      setLastResult(r);
      if (r.ok) toast.success(`Test OK · ${r.status} · ${r.latencyMs} ms`);
      else toast.error(`Test failed${r.status ? ` · ${r.status}` : ""}${r.error ? ` · ${r.error}` : ""}`);
      qc.invalidateQueries({ queryKey: ["sap-endpoint", id] });
      qc.invalidateQueries({ queryKey: ["sap-endpoint-log", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (!isAdmin) return null;
  if (isLoading || !ep) return <Skeleton className="h-96 w-full rounded-lg" />;

  const set = (patch: Partial<SapEndpoint>) => setEp({ ...ep, ...patch });
  const shown = lastResult ?? {
    ok: !!ep.last_test_ok,
    status: ep.last_test_status,
    latencyMs: ep.last_test_ms ?? 0,
    body: ep.last_test_body ?? "",
    error: ep.last_test_error,
  };

  return (
    <div className="space-y-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Admin · SAP API Settings
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Link to="/admin/sap-api">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">{ep.name}</h1>
            <Badge variant="secondary" className="mt-1 text-[10px] uppercase tracking-wider">
              {ep.module}
            </Badge>
          </div>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" disabled={testing} onClick={runTest}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Test connection
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Name</Label>
                <Input id="d-name" value={ep.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Select value={ep.module} onValueChange={(v) => set({ module: v })}>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-desc">Description</Label>
              <Textarea
                id="d-desc"
                rows={3}
                value={ep.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-path">Endpoint Path or URL</Label>
              <Input id="d-path" value={ep.path_or_url} onChange={(e) => set({ path_or_url: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Use a relative path (starting with /) to inherit the host from the selected SAP system — the SAP
                client is appended automatically. A full http(s):// URL is also accepted.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>SAP system</Label>
              <Select
                value={ep.system_id || "__active"}
                onValueChange={(v) => set({ system_id: v === "__active" ? null : v })}
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>HTTP method</Label>
                <Select value={ep.http_method} onValueChange={(v) => set({ http_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAP_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Auth type</Label>
                <Select value={ep.auth_type} onValueChange={(v) => set({ auth_type: v })}>
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
              <div className="space-y-1.5">
                <Label>API type</Label>
                <Select value={ep.api_type} onValueChange={(v) => set({ api_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAP_API_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id="d-active" checked={ep.active} onCheckedChange={(v) => set({ active: v })} />
                <Label htmlFor="d-active">Active</Label>
              </div>
            </div>
            <SaveBar pending={saveMut.isPending} onClick={() => saveMut.mutate()} label="Save details" />
          </div>
        </TabsContent>

        <TabsContent value="request" className="mt-4">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
            <KVEditor rows={headers} onChange={setHeaders} label="Request headers" />
            <KVEditor rows={query} onChange={setQuery} label="Query parameters" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="d-body">Body template (JSON)</Label>
                {/^\s*create\s*e-?nfa/i.test(ep.name ?? "") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => set({ request_body: CREATE_BODY_SAMPLE })}
                  >
                    Insert sample payload
                  </Button>
                )}
              </div>
              <Textarea
                id="d-body"
                rows={8}
                className="font-mono text-xs"
                placeholder={/^\s*create\s*e-?nfa/i.test(ep.name ?? "") ? CREATE_BODY_SAMPLE : '{\n  "PLANT": "9000"\n}'}
                value={ep.request_body ?? ""}
                onChange={(e) => set({ request_body: e.target.value })}
              />
              {/^\s*create\s*e-?nfa/i.test(ep.name ?? "") && (
                <p className="text-xs text-muted-foreground">
                  Values are filled at runtime from the Create NFA form; <code>user_name</code> is the signed-in user's User ID.
                </p>
              )}
            </div>
            <SaveBar pending={saveMut.isPending} onClick={() => saveMut.mutate()} label="Save request" />
          </div>
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusPill ok={shown.ok} status={shown.status} />
              <span className="text-muted-foreground">{shown.latencyMs ? `${shown.latencyMs} ms` : "—"}</span>
              <span className="text-muted-foreground">
                {ep.last_test_at ? new Date(ep.last_test_at).toLocaleString() : "Never tested"}
              </span>
            </div>
            {shown.error && <p className="text-sm text-destructive">{shown.error}</p>}
            <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-3 text-xs">
              {prettify(shown.body) || "No response captured yet — run a test."}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="mt-4">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Leave these blank to inherit the shared technical user from SAP Connection.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-user">Username override</Label>
                <Input
                  id="c-user"
                  value={ep.username ?? ""}
                  onChange={(e) => set({ username: e.target.value })}
                  placeholder="Inherit from SAP Connection"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-pass" className="flex items-center gap-2">
                  Password / token override
                  {ep.has_password && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      set
                    </span>
                  )}
                </Label>
                <Input
                  id="c-pass"
                  type="password"
                  placeholder={ep.has_password ? "•••••••• (leave blank to keep)" : "Inherit from SAP Connection"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <SaveBar pending={saveMut.isPending} onClick={() => saveMut.mutate()} label="Save credentials" />
          </div>
        </TabsContent>

        <TabsContent value="scheduler" className="mt-4">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Switch
                id="s-enabled"
                checked={ep.schedule_enabled}
                onCheckedChange={(v) => set({ schedule_enabled: v })}
              />
              <Label htmlFor="s-enabled">Run this endpoint on a schedule</Label>
            </div>
            <div className="space-y-1.5 md:max-w-sm">
              <Label htmlFor="s-cron">Schedule (cron)</Label>
              <Input
                id="s-cron"
                placeholder="*/15 * * * *"
                value={ep.schedule_cron ?? ""}
                onChange={(e) => set({ schedule_cron: e.target.value })}
                disabled={!ep.schedule_enabled}
              />
              <p className="text-xs text-muted-foreground">
                Standard five-field cron, evaluated in UTC. Applies only to sync-type endpoints.
              </p>
            </div>
            <SaveBar pending={saveMut.isPending} onClick={() => saveMut.mutate()} label="Save scheduler" />
          </div>
        </TabsContent>

        <TabsContent value="connectivity" className="mt-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Recent tests</h3>
              <Button variant="outline" size="sm" className="gap-2" disabled={testing} onClick={runTest}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Run test
              </Button>
            </div>
            {(history ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No tests recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(history ?? []).map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <StatusPill ok={h.ok} status={h.status} />
                    <span className="text-muted-foreground">{h.latency_ms ?? 0} ms</span>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{h.message ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaveBar({ pending, onClick, label }: { pending: boolean; onClick: () => void; label: string }) {
  return (
    <div className="flex justify-end border-t border-border/70 pt-4">
      <Button className="gap-2" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {label}
      </Button>
    </div>
  );
}

function StatusPill({ ok, status }: { ok: boolean; status: number | null }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive")
      }
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {status ?? "error"}
    </span>
  );
}

function prettify(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
