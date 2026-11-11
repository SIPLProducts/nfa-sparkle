import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { swalConfirm, toast } from "@/lib/swal";
import {
  createCompanySeries,
  deleteCompanySeries,
  listCompanySeries,
  updateCompanySeries,
  type CompanySeries,
} from "@/lib/company-series.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const seriesQueryKey = ["company-series"];

export function RangeTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCompanySeries);
  const createFn = useServerFn(createCompanySeries);
  const updateFn = useServerFn(updateCompanySeries);
  const deleteFn = useServerFn(deleteCompanySeries);
  const { data, isLoading } = useQuery({ queryKey: seriesQueryKey, queryFn: () => listFn() });
  const [term, setTerm] = useState("");
  const [dialog, setDialog] = useState<{ mode: "create" | "edit" | "view"; row?: CompanySeries } | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Series deleted"); qc.invalidateQueries({ queryKey: seriesQueryKey }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = (data ?? []).filter((r) => !term || `${r.series} ${r.range_from} ${r.range_to}`.includes(term.trim()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search series" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <Button className="gap-2" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Create series</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Series</th>
              <th className="px-4 py-2.5 text-left font-medium">From</th>
              <th className="px-4 py-2.5 text-left font-medium">To</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No series yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.series}</td>
                <td className="px-4 py-3 tabular-nums">{r.range_from}</td>
                <td className="px-4 py-3 tabular-nums">{r.range_to}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label="View" onClick={() => setDialog({ mode: "view", row: r })}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setDialog({ mode: "edit", row: r })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete" className="text-destructive"
                      onClick={async () => { if (await swalConfirm({ title: `Delete series ${r.series}?` } as any)) del.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog && (
        <SeriesDialog
          key={dialog.row?.id ?? "new"}
          mode={dialog.mode}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            if (dialog.mode === "edit" && dialog.row) await updateFn({ data: { id: dialog.row.id, ...v } });
            else await createFn({ data: v });
            toast.success(dialog.mode === "edit" ? "Series updated" : "Series created");
            qc.invalidateQueries({ queryKey: seriesQueryKey });
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function SeriesDialog({ mode, row, onClose, onSave }: {
  mode: "create" | "edit" | "view";
  row?: CompanySeries;
  onClose: () => void;
  onSave: (v: { series: string; range_from: string; range_to: string }) => Promise<void>;
}) {
  const [series, setSeries] = useState(row?.series ?? "");
  const [from, setFrom] = useState(row ? String(row.range_from) : "");
  const [to, setTo] = useState(row ? String(row.range_to) : "");
  const [busy, setBusy] = useState(false);
  const ro = mode === "view";
  const req = <span className="text-destructive">*</span>;
  const digits = (v: string) => v.replace(/\D/g, "");
  const submit = async () => {
    if (!series.trim()) return toast.error("Series is required");
    if (!from) return toast.error("From is required");
    if (!to) return toast.error("To is required");
    if (Number(from) > Number(to)) return toast.error("From must not be greater than To");
    setBusy(true);
    try { await onSave({ series, range_from: from, range_to: to }); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "create" ? "Create series" : mode === "edit" ? "Edit series" : "Series"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Series {req}</Label><Input value={series} readOnly={ro} onChange={(e) => setSeries(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>From {req}</Label><Input inputMode="numeric" value={from} readOnly={ro} onChange={(e) => setFrom(digits(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>To {req}</Label><Input inputMode="numeric" value={to} readOnly={ro} onChange={(e) => setTo(digits(e.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ro ? "Close" : "Cancel"}</Button>
          {!ro && <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
