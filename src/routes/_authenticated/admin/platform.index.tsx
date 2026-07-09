import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { PlatformTabs } from "@/components/platform-tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { GATEWAYS } from "@/lib/gateways/registry";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/admin/platform/")({
  head: () => ({ meta: [{ title: "Platform Gateways · Admin" }] }),
  component: PlatformGatewaysPage,
});

type Row = {
  id: string;
  provider: string;
  mode: string;
  credentials: Record<string, string>;
  is_active: boolean;
  is_enabled_for_merchants: boolean;
  commission_percent: number;
  commission_flat: number;
};

type SbClient = {
  from: (t: string) => {
    select: (s: string) => { order: (c: string, o: object) => Promise<{ data: Row[] | null }> };
    upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }>;
    delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  };
};

function PlatformGatewaysPage() {
  const client = supabase as unknown as SbClient;
  const [rows, setRows] = useState<Row[]>([]);
  const [provider, setProvider] = useState("stripe");
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [pct, setPct] = useState("0");
  const [flat, setFlat] = useState("0");
  const [enabled, setEnabled] = useState(true);

  const spec = useMemo(() => GATEWAYS.find((p) => p.id === provider)!, [provider]);

  const load = async () => {
    const { data } = await client.from("platform_gateways")
      .select("id, provider, mode, credentials, is_active, is_enabled_for_merchants, commission_percent, commission_flat")
      .order("provider", { ascending: true });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setCreds({}); }, [provider]);

  const save = async () => {
    for (const f of spec.fields) {
      if (f.required && !creds[f.key]?.trim()) return toast.error(`Missing ${f.label}`);
    }
    const { error } = await client.from("platform_gateways").upsert({
      provider, mode, credentials: creds, is_active: true,
      is_enabled_for_merchants: enabled,
      commission_percent: Number(pct), commission_flat: Number(flat),
    }, { onConflict: "provider" });
    if (error) return toast.error(error.message);
    toast.success(`Platform ${spec.label} saved`);
    setCreds({}); load();
  };

  const toggle = async (r: Row) => {
    const { error } = await client.from("platform_gateways")
      .update({ is_enabled_for_merchants: !r.is_enabled_for_merchants }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await client.from("platform_gateways").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminShell title="Platform Gateways" subtitle="Hold master gateway credentials. Merchants can opt-in; platform takes the configured commission.">
      <PlatformTabs />
      <Card className="p-5">
        <h3 className="mb-3 font-medium">Add / update</h3>
        <div className="grid gap-3 md:grid-cols-[240px_180px_120px_120px_auto]">
          <select className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={provider} onChange={(e) => setProvider(e.target.value)}>
            {GATEWAYS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={mode} onChange={(e) => setMode(e.target.value as "sandbox" | "live")}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <Input placeholder="Commission %" value={pct} onChange={(e) => setPct(e.target.value)} />
          <Input placeholder="Commission flat" value={flat} onChange={(e) => setFlat(e.target.value)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Available to merchants
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {spec.fields.map((f) => (
            f.type === "textarea" ? (
              <Textarea key={f.key} placeholder={f.placeholder ?? f.label} className="md:col-span-2 min-h-24"
                value={creds[f.key] ?? ""} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
            ) : (
              <Input key={f.key} placeholder={f.placeholder ?? f.label}
                type={f.type === "password" ? "password" : "text"}
                value={creds[f.key] ?? ""} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
            )
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save}>Save platform gateway</Button>
        </div>
      </Card>

      <div className="mt-6">
        <DataTable<Row>
          columns={[
            { key: "provider", label: "Provider", sortable: true, render: (r) => <span className="capitalize">{r.provider.replace("_", " ")}</span> },
            { key: "mode", label: "Mode", sortable: true, render: (r) => <Badge variant={r.mode === "live" ? "default" : "outline"}>{r.mode}</Badge> },
            { key: "fee", label: "Fee", render: (r) => `${r.commission_percent}% + ${r.commission_flat}` },
            {
              key: "is_enabled_for_merchants",
              label: "Available",
              sortable: true,
              accessor: (r) => (r.is_enabled_for_merchants ? "enabled" : "disabled"),
              render: (r) => (
                <Button size="sm" variant={r.is_enabled_for_merchants ? "default" : "outline"} onClick={() => toggle(r)}>
                  {r.is_enabled_for_merchants ? "Enabled" : "Disabled"}
                </Button>
              ),
            },
          ] as DataTableColumn<Row>[]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyMessage="No platform gateways configured"
          searchable={(r) => `${r.provider} ${r.mode}`}
          filters={[
            {
              key: "mode",
              label: "Mode",
              options: [
                { value: "sandbox", label: "Sandbox" },
                { value: "live", label: "Live" },
              ],
              match: (r, v) => r.mode === v,
            },
            {
              key: "available",
              label: "Available",
              options: [
                { value: "enabled", label: "Enabled" },
                { value: "disabled", label: "Disabled" },
              ],
              match: (r, v) => (v === "enabled" ? r.is_enabled_for_merchants : !r.is_enabled_for_merchants),
            },
          ] as DataTableFilter<Row>[]}
          actions={(r) => (
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          exportFilename="platform-gateways"
        />
      </div>
    </AdminShell>
  );
}
