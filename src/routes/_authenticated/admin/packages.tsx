import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, Users, Save, CalendarClock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MERCHANT_PERMS } from "@/lib/permissions";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateSubscription } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  head: () => ({ meta: [{ title: "Subscription packages · PayNOC" }] }),
  component: AdminPackagesPage,
});

type BillingCycle = "monthly" | "yearly" | "lifetime";

type Pkg = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: BillingCycle;
  trial_days: number;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
};

type Sub = {
  id: string;
  merchant_id: string;
  package_id: string;
  status: string;
  started_at: string;
  current_period_end: string | null;
  auto_renew: boolean;
  merchant_email?: string | null;
  merchant_name?: string | null;
  package_name?: string | null;
  billing_cycle?: BillingCycle;
};

const EMPTY: Pkg = {
  id: "",
  name: "",
  slug: "",
  description: "",
  price: 0,
  currency: "BDT",
  billing_cycle: "monthly",
  trial_days: 0,
  features: [],
  limits: {},
  permissions: [],
  is_active: true,
  is_public: true,
  sort_order: 0,
};

function AdminPackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ merchant_email: "", package_id: "", auto_renew: true });
  const [busy, setBusy] = useState(false);
  const [editSub, setEditSub] = useState<Sub | null>(null);
  const [subForm, setSubForm] = useState({ package_id: "", end_date: "", auto_renew: true });
  const [subQ, setSubQ] = useState("");
  const [subStatus, setSubStatus] = useState<string>("all");
  const updateSubFn = useServerFn(adminUpdateSubscription);

  const load = useCallback(async () => {
    const { data: pkgs } = await supabase
      .from("subscription_packages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setPackages(((pkgs ?? []) as unknown) as Pkg[]);

    const { data: srows } = await supabase
      .from("merchant_subscriptions")
      .select("id, merchant_id, package_id, status, started_at, current_period_end, auto_renew")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (srows ?? []) as Sub[];
    if (rows.length) {
      const mIds = [...new Set(rows.map((r) => r.merchant_id))];
      const pIds = [...new Set(rows.map((r) => r.package_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, business_name")
        .in("id", mIds);
      const { data: pks } = await supabase
        .from("subscription_packages")
        .select("id, name, billing_cycle")
        .in("id", pIds);
      const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const pkMap = new Map(((pks ?? []) as unknown as Pkg[]).map((p) => [p.id, p]));
      rows.forEach((r) => {
        const pf = pMap.get(r.merchant_id);
        const pk = pkMap.get(r.package_id);
        r.merchant_email = pf?.email ?? null;
        r.merchant_name = pf?.business_name ?? null;
        r.package_name = pk?.name ?? null;
        r.billing_cycle = pk?.billing_cycle;
      });
    }
    setSubs(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.slug.trim()) return toast.error("Name and slug required");
    setBusy(true);
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug.trim().toLowerCase(),
      description: editing.description,
      price: Number(editing.price) || 0,
      currency: editing.currency,
      billing_cycle: editing.billing_cycle,
      trial_days: Number(editing.trial_days) || 0,
      features: editing.features,
      limits: editing.limits,
      permissions: editing.permissions,
      is_active: editing.is_active,
      is_public: editing.is_public,
      sort_order: Number(editing.sort_order) || 0,
    };
    const q = editing.id
      ? supabase.from("subscription_packages").update(payload).eq("id", editing.id)
      : supabase.from("subscription_packages").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this package? Existing subscriptions will keep running.")) return;
    const { error } = await supabase.from("subscription_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const assign = async () => {
    if (!assignForm.merchant_email || !assignForm.package_id) return toast.error("Fill all fields");
    setBusy(true);
    const { data: prof, error: perr } = await supabase
      .from("profiles").select("id").eq("email", assignForm.merchant_email.trim().toLowerCase()).maybeSingle();
    if (perr || !prof) { setBusy(false); return toast.error("Merchant not found"); }
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) =>
      Promise<{ data: unknown; error: { message: string } | null }>;
    const { error } = await rpc("assign_subscription", {
      _merchant_id: prof.id, _package_id: assignForm.package_id, _auto_renew: assignForm.auto_renew,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Subscription assigned");
    setAssigning(false);
    setAssignForm({ merchant_email: "", package_id: "", auto_renew: true });
    load();
  };

  const cancelSub = async (id: string) => {
    if (!confirm("Cancel this subscription?")) return;
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) =>
      Promise<{ error: { message: string } | null }>;
    const { error } = await rpc("cancel_subscription", { _subscription_id: id });
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    load();
  };

  return (
    <AdminShell title="Subscription packages" subtitle="Plans, pricing, and merchant subscriptions">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="mr-2 h-4 w-4" /> New package
        </Button>
        <Button variant="outline" onClick={() => setAssigning(true)}>
          <Users className="mr-2 h-4 w-4" /> Assign to merchant
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold">{p.name}</h3>
                  {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                  {!p.is_public && <Badge variant="outline">Hidden</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">/{p.slug}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold">
                  {p.currency} {Number(p.price).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{p.billing_cycle}</div>
              </div>
            </div>
            {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
            {p.trial_days > 0 && (
              <div className="mt-2 text-xs text-brand">{p.trial_days}-day free trial</div>
            )}
            {p.features.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {p.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-muted-foreground">• {f}</li>
                ))}
                {p.features.length > 5 && (
                  <li className="text-xs text-muted-foreground">+{p.features.length - 5} more</li>
                )}
              </ul>
            )}
            {p.permissions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {p.permissions.map((k) => (
                  <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, features: p.features ?? [], permissions: p.permissions ?? [], limits: p.limits ?? {} })}>
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          </Card>
        ))}
        {packages.length === 0 && (
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No packages yet. Click "New package" to create the first plan.
          </Card>
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-display text-xl font-bold">Active subscriptions</h2>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Merchant</div><div>Package</div><div>Status</div><div>Cycle</div><div>Ends</div><div></div>
          </div>
          {subs.map((s) => (
            <div key={s.id} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-3 border-b border-border px-4 py-2 text-sm">
              <div>
                <div className="font-medium">{s.merchant_name || s.merchant_email}</div>
                <div className="text-xs text-muted-foreground">{s.merchant_email}</div>
              </div>
              <div>{s.package_name}</div>
              <div>
                <Badge variant={s.status === "active" || s.status === "trialing" ? "default" : "secondary"}>
                  {s.status}
                </Badge>
              </div>
              <div className="capitalize text-muted-foreground">{s.billing_cycle}</div>
              <div className="text-muted-foreground">
                {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
              </div>
              <div>
                {(s.status === "active" || s.status === "trialing") && (
                  <Button size="sm" variant="ghost" onClick={() => cancelSub(s.id)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
          {subs.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No subscriptions yet.</div>
          )}
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label>Price</Label>
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>Billing</Label>
                  <Select value={editing.billing_cycle} onValueChange={(v) => setEditing({ ...editing, billing_cycle: v as BillingCycle })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trial days</Label>
                  <Input type="number" value={editing.trial_days} onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <Textarea rows={4} value={editing.features.join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Unlimited invoices&#10;Custom checkout branding&#10;Priority support" />
              </div>
              <div>
                <Label>Feature permissions unlocked</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
                  {MERCHANT_PERMS.map((p) => {
                    const on = editing.permissions.includes(p.key);
                    return (
                      <label key={p.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={on} onChange={(e) => {
                          const next = e.target.checked
                            ? [...editing.permissions, p.key]
                            : editing.permissions.filter((x) => x !== p.key);
                          setEditing({ ...editing, permissions: next });
                        }} />
                        {p.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={editing.is_public} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} />
                  <span className="text-sm">Public (show on pricing)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Sort</Label>
                  <Input type="number" className="w-20" value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assigning} onOpenChange={setAssigning}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign subscription</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Merchant email</Label>
              <Input value={assignForm.merchant_email}
                onChange={(e) => setAssignForm({ ...assignForm, merchant_email: e.target.value })}
                placeholder="merchant@example.com" />
            </div>
            <div>
              <Label>Package</Label>
              <Select value={assignForm.package_id} onValueChange={(v) => setAssignForm({ ...assignForm, package_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
                <SelectContent>
                  {packages.filter((p) => p.is_active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.currency} {p.price} / {p.billing_cycle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={assignForm.auto_renew} onCheckedChange={(v) => setAssignForm({ ...assignForm, auto_renew: v })} />
              <span className="text-sm">Auto-renew at period end</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(false)}>Cancel</Button>
            <Button onClick={assign} disabled={busy}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
