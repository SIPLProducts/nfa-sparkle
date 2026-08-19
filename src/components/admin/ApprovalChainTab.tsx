import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GitBranch, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listManagedUsers, listRoleDefs } from "@/lib/user-admin.functions";
import {
  deleteApprovalChain,
  listApprovalChains,
  saveApprovalChain,
  setApprovalChainActive,
  type ApprovalChain,
} from "@/lib/approval-chain.functions";

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

interface DraftLevel {
  approver_id: string;
  designation: string;
}

interface Draft {
  id: string | null;
  name: string;
  owner_user_id: string;
  role_key: string;
  is_active: boolean;
  levels: DraftLevel[];
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "",
  owner_user_id: "",
  role_key: "",
  is_active: true,
  levels: [{ approver_id: "", designation: "" }],
};

export function ApprovalChainTab() {
  const qc = useQueryClient();
  const fetchChains = useServerFn(listApprovalChains);
  const fetchUsers = useServerFn(listManagedUsers);
  const fetchRoles = useServerFn(listRoleDefs);
  const save = useServerFn(saveApprovalChain);
  const remove = useServerFn(deleteApprovalChain);
  const toggle = useServerFn(setApprovalChainActive);

  const chains = useQuery({ queryKey: ["approval-chains"], queryFn: () => fetchChains() });
  const users = useQuery({ queryKey: ["managed-users"], queryFn: () => fetchUsers() });
  const roles = useQuery({ queryKey: ["role-defs"], queryFn: () => fetchRoles() });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const userOptions = useMemo(
    () => (users.data ?? []).map((u) => ({ id: u.id, label: u.full_name || u.email, sub: u.email })),
    [users.data],
  );
  const nameOf = (id: string) => userOptions.find((u) => u.id === id)?.label ?? "—";

  const invalidate = () => qc.invalidateQueries({ queryKey: ["approval-chains"] });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          name: d.name,
          owner_user_id: d.owner_user_id || null,
          role_key: d.role_key || null,
          is_active: d.is_active,
          levels: d.levels
            .filter((l) => l.approver_id)
            .map((l) => ({ approver_id: l.approver_id, designation: l.designation })),
        },
      }),
    onSuccess: () => {
      toast.success("Approval chain saved");
      setOpen(false);
      void invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Approval chain deleted");
      void invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error(errMsg(e)),
  });

  function openNew() {
    setDraft({ ...EMPTY_DRAFT, levels: [{ approver_id: "", designation: "" }] });
    setOpen(true);
  }

  function openEdit(c: ApprovalChain) {
    setDraft({
      id: c.id,
      name: c.name,
      owner_user_id: c.owner_user_id ?? "",
      role_key: c.role_key ?? "",
      is_active: c.is_active,
      levels: c.levels.length
        ? c.levels.map((l) => ({ approver_id: l.approver_id, designation: l.designation ?? "" }))
        : [{ approver_id: "", designation: "" }],
    });
    setOpen(true);
  }

  function setLevel(i: number, patch: Partial<DraftLevel>) {
    setDraft((p) => ({ ...p, levels: p.levels.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }

  function moveLevel(i: number, dir: -1 | 1) {
    setDraft((p) => {
      const next = [...p.levels];
      const j = i + dir;
      if (j < 0 || j >= next.length) return p;
      const a = next[i]!;
      next[i] = next[j]!;
      next[j] = a;
      return { ...p, levels: next };
    });
  }

  const list = chains.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Define ordered approval flows. Each level points to a specific user.
        </p>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> New chain
        </Button>
      </div>

      {chains.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No approval chains yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a chain to define who approves, and in what order.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Chain</th>
                <th className="px-4 py-2.5 font-medium">Applies to</th>
                <th className="px-4 py-2.5 font-medium">Levels</th>
                <th className="px-4 py-2.5 font-medium">Active</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.levels.map((l) => (
                        <Badge key={l.level} variant="secondary" className="font-normal">
                          L{l.level} · {l.approver_name || l.approver_email || "—"}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{c.owner_name ?? "Any user"}</div>
                    <div className="text-xs text-muted-foreground">{c.role_key ?? "Any role"}</div>
                  </td>
                  <td className="px-4 py-3">{c.levels.length}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: c.id, is_active: v })}
                      aria-label="Toggle chain active"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive"
                        onClick={() => deleteMut.mutate(c.id)}
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{draft.id ? "Edit approval chain" : "New approval chain"}</DialogTitle>
            <DialogDescription>Pick who the chain applies to, then order the approvers.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <Label>Chain name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Budget deviation — plant 9000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Applies to user</Label>
              <Select
                value={draft.owner_user_id || "_any"}
                onValueChange={(v) => setDraft((p) => ({ ...p, owner_user_id: v === "_any" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">Any user</SelectItem>
                  {userOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label} — {u.sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Applies to role</Label>
              <Select
                value={draft.role_key || "_any"}
                onValueChange={(v) => setDraft((p) => ({ ...p, role_key: v === "_any" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">Any role</SelectItem>
                  {(roles.data ?? []).map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive chains are kept but not used.</p>
              </div>
              <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft((p) => ({ ...p, is_active: v }))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Approval levels *</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setDraft((p) => ({ ...p, levels: [...p.levels, { approver_id: "", designation: "" }] }))
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add level
                </Button>
              </div>
              {draft.levels.map((l, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Level {i + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={i === 0}
                        onClick={() => moveLevel(i, -1)}
                        aria-label="Move level up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={i === draft.levels.length - 1}
                        onClick={() => moveLevel(i, 1)}
                        aria-label="Move level down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        disabled={draft.levels.length === 1}
                        onClick={() => setDraft((p) => ({ ...p, levels: p.levels.filter((_, idx) => idx !== i) }))}
                        aria-label="Remove level"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={l.approver_id} onValueChange={(v) => setLevel(i, { approver_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver" />
                      </SelectTrigger>
                      <SelectContent>
                        {userOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.label} — {u.sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={l.designation}
                      placeholder="Designation (optional)"
                      onChange={(e) => setLevel(i, { designation: e.target.value })}
                    />
                  </div>
                  {l.approver_id ? (
                    <p className="mt-2 text-xs text-muted-foreground">Approver: {nameOf(l.approver_id)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending} className="gap-2">
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save chain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
