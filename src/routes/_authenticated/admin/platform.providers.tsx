import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { PlatformTabs } from "@/components/platform-tabs";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/platform/providers")({
  head: () => ({ meta: [{ title: "Provider toggles · Admin" }] }),
  component: ProviderTogglesPage,
});

type Row = {
  provider: string;
  category: "bd" | "international" | "crypto" | "manual";
  label: string;
  enabled: boolean;
};

const GROUPS: { key: Row["category"]; label: string; hint: string }[] = [
  { key: "bd", label: "Bangladesh / Auto gateways", hint: "bKash, Nagad, SSLCommerz, UddoktaPay…" },
  { key: "international", label: "International gateways", hint: "Stripe, PayPal, Razorpay, Paddle…" },
  { key: "crypto", label: "Crypto gateways", hint: "Coinbase Commerce, NOWPayments, Cryptomus…" },
  { key: "manual", label: "Manual payment methods", hint: "Bank transfer, QR, wallets verified via Android/SMS or manual proof…" },
];

// Providers that can ALSO be accepted as manual methods (verified via the
// Android SMS listener or merchant proof). Shown in the Manual group in
// addition to their native category so admins can manage them together.
const MANUAL_ELIGIBLE = new Set([
  "bkash","nagad","rocket","upay","tap","mcash","cellfin","surecash",
]);


function ProviderTogglesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("gateway_provider_toggles" as never)
      .select("provider, category, label, enabled")
      .order("category")
      .order("label");
    if (error) return toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (r: Row, value: boolean) => {
    setBusy(r.provider);
    const { error } = await supabase
      .from("gateway_provider_toggles" as never)
      .update({ enabled: value, updated_at: new Date().toISOString() } as never)
      .eq("provider", r.provider);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((x) => x.provider === r.provider ? { ...x, enabled: value } : x));
    toast.success(`${r.label} ${value ? "enabled" : "disabled"}`);
  };

  const query = q.trim().toLowerCase();
  const visible = query
    ? rows.filter((r) => `${r.label} ${r.provider}`.toLowerCase().includes(query))
    : rows;

  return (
    <AdminShell title="Provider toggles" subtitle="Master ON/OFF for every payment provider. Disabled providers disappear from merchant portals and customer checkout everywhere.">
      <PlatformTabs />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search provider…" className="h-9 max-w-xs" />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.filter((r) => r.enabled).length} of {rows.length} enabled
        </span>
      </div>

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = visible.filter((r) => r.category === g.key);
          if (items.length === 0) return null;
          return (
            <Card key={g.key} className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Power className="h-4 w-4 text-brand" /> {g.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.hint}</p>
                </div>
                <Badge variant="outline">{items.filter((r) => r.enabled).length}/{items.length} on</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <div
                    key={r.provider}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition ${
                      r.enabled ? "border-glass-border bg-background/40" : "border-glass-border bg-muted/30 opacity-70"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.label}</div>
                      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{r.provider}</div>
                    </div>
                    <Switch
                      checked={r.enabled}
                      disabled={busy === r.provider}
                      onCheckedChange={(v) => toggle(r, v)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
