import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { swalConfirm, toast } from "@/lib/swal";
import {
  createMasterItem,
  deleteMasterItem,
  listMasterItems,
  updateMasterItem,
  type MasterItem,
  type MasterKind,
} from "@/lib/master-lists.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const fmt = (s: string) => new Date(s).toLocaleString();

export function MasterListTab({
  kind,
  singular,
  nameLabel = "Name",
  showCode = true,
  showActive = true,
  codeLabel = "Code",
  descriptionLabel = "Description",
}: {
  kind: MasterKind;
  singular: string;
  nameLabel?: string;
  showCode?: boolean;
  showActive?: boolean;
  codeLabel?: string;
  descriptionLabel?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMasterItems);
  const createFn = useServerFn(createMasterItem);
  const updateFn = useServerFn(updateMasterItem);
  const deleteFn = useServerFn(deleteMasterItem);
  const queryKey = ["master-list", kind];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => listFn({ data: { kind } }) });
  const [term, setTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [viewing, setViewing] = useState<MasterItem | null>(null);
  const lower = singular.toLowerCase();

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { kind, id } }),
    onSuccess: () => {
      toast.success(`${singular} deleted`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const t = term.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (r) => !t || r.name.toLowerCase().includes(t) || (r.code ?? "").toLowerCase().includes(t),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={`Search ${lower}s`} value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create {lower}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {showCode && <th className="px-3 py-2 font-medium">{codeLabel}</th>}
              <th className="px-3 py-2 font-medium">{nameLabel}</th>
              <th className="px-3 py-2 font-medium">{descriptionLabel}</th>
              {showActive && <th className="px-3 py-2 font-medium">Status</th>}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3 + (showCode ? 1 : 0) + (showActive ? 1 : 0)} className="px-3 py-8 text-center text-muted-foreground">
                  No {lower}s found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  {showCode && <td className="px-3 py-2">{r.code || "—"}</td>}
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.description || "—"}</td>
                  {showActive && (
                    <td className="px-3 py-2">
                      <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" aria-label="View" onClick={() => setViewing(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete"
                        disabled={remove.isPending}
                        onClick={async () => {
                          const ok = await swalConfirm({
                            title: `Delete this ${lower}?`,
                            text: "This cannot be undone.",
                            confirmText: "Delete",
                            destructive: true,
                          });
                          if (ok) remove.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ItemDialog
        open={createOpen}
        singular={singular}
        nameLabel={nameLabel}
        showCode={showCode}
        showActive={showActive}
        codeLabel={codeLabel}
        descriptionLabel={descriptionLabel}
        item={null}
        onOpenChange={setCreateOpen}
        onSubmit={async (v) => {
          await createFn({ data: { kind, item: v } });
          toast.success(`${singular} created`);
          invalidate();
        }}
      />
      <ItemDialog
        open={!!editing}
        singular={singular}
        nameLabel={nameLabel}
        showCode={showCode}
        showActive={showActive}
        codeLabel={codeLabel}
        descriptionLabel={descriptionLabel}
        item={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={async (v) => {
          if (!editing) return;
          await updateFn({ data: { kind, id: editing.id, item: v } });
          toast.success(`${singular} updated`);
          invalidate();
        }}
      />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{singular} details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <dt className="text-muted-foreground">{nameLabel}</dt>
              <dd className="col-span-2 font-medium">{viewing.name}</dd>
              {showCode && (
                <>
                  <dt className="text-muted-foreground">{codeLabel}</dt>
                  <dd className="col-span-2">{viewing.code || "—"}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{descriptionLabel}</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{viewing.description || "—"}</dd>
              {showActive && (
                <>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="col-span-2">{viewing.is_active ? "Active" : "Inactive"}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Created</dt>
              <dd className="col-span-2">{fmt(viewing.created_at)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="col-span-2">{fmt(viewing.updated_at)}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemDialog({
  open,
  singular,
  nameLabel,
  showCode,
  showActive,
  codeLabel,
  descriptionLabel,
  item,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  singular: string;
  nameLabel: string;
  showCode: boolean;
  showActive: boolean;
  codeLabel: string;
  descriptionLabel: string;
  item: MasterItem | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: { name: string; code: string; description: string; is_active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setCode(item?.code ?? "");
      setDescription(item?.description ?? "");
      setActive(item?.is_active ?? true);
      setNameError(false);
    }
  }, [open, item]);

  const save = async () => {
    if (!name.trim()) {
      setNameError(true);
      toast.error(`${nameLabel} is required`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name, code, description, is_active: active });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${singular.toLowerCase()}` : `Create ${singular.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {showCode && (
            <div className="space-y-1.5">
              <Label>{codeLabel}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>
              {nameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
            />
            {nameError && <p className="text-xs text-destructive">{nameLabel} is required</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{descriptionLabel}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {showActive && (
            <div className="flex items-center gap-3">
              <Switch checked={active} onCheckedChange={setActive} id="master-active" />
              <Label htmlFor="master-active">Active</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {item ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
