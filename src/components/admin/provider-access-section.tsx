import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GATEWAYS } from "@/lib/gateways/registry";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Manual method types stored in payment_methods.type that aren't in GATEWAYS.
const MANUAL_METHODS = [
  { id: "bank_transfer", label: "Bank Transfer", region: "MANUAL" as const },
  { id: "bangla_qr", label: "Bangla QR", region: "MANUAL" as const },
  { id: "card", label: "Card (manual)", region: "MANUAL" as const },
  { id: "crypto", label: "Crypto (manual)", region: "MANUAL" as const },
  { id: "sure_cash", label: "SureCash (manual)", region: "MANUAL" as const },
  { id: "other", label: "Other (manual)", region: "MANUAL" as const },
];

type Row = { merchant_id: string; provider: string; enabled: boolean };

export function ProviderAccessSection({ merchantId }: { merchantId: string }) {
  const [grants, setGrants] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const providers = useMemo(() => {
    const gw = GATEWAYS.map((g) => ({ id: g.id, label: g.label, region: g.region as string }));
    return [...gw, ...MANUAL_METHODS];
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("merchant_provider_grants" as never)
      .select("provider, enabled")
      .eq("merchant_id", merchantId);
    if (error) {
      toast.error(error.message);
    } else {
      const map: Record<string, boolean> = {};
      (data as unknown as Row[] | null)?.forEach((r) => (map[r.provider] = r.enabled));
      setGrants(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
     
  }, [merchantId]);

  const toggle = async (provider: string, enabled: boolean) => {
    setBusy(provider);
    const { error } = await supabase
      .from("merchant_provider_grants" as never)
      .upsert(
        { merchant_id: merchantId, provider, enabled, updated_at: new Date().toISOString() } as never,
        { onConflict: "merchant_id,provider" },
      );
    if (error) {
      toast.error(error.message);
    } else {
      setGrants((g) => ({ ...g, [provider]: enabled }));
      toast.success(`${provider} ${enabled ? "enabled" : "disabled"} for this merchant`);
    }
    setBusy(null);
  };

  const reset = async (provider: string) => {
    setBusy(provider);
    const { error } = await supabase
      .from("merchant_provider_grants" as never)
      .delete()
      .eq("merchant_id", merchantId)
      .eq("provider", provider);
    if (error) toast.error(error.message);
    else {
      setGrants((g) => {
        const n = { ...g };
        delete n[provider];
        return n;
      });
      toast.success(`${provider} reverted to package default`);
    }
    setBusy(null);
  };

  const groups: Record<string, typeof providers> = {
    "Bangladesh / Auto": [],
    International: [],
    Crypto: [],
    Manual: [],
  };
  for (const p of providers) {
    if (p.region === "BD") groups["Bangladesh / Auto"].push(p);
    else if (p.region === "GLOBAL") groups["International"].push(p);
    else if (p.region === "CRYPTO") groups["Crypto"].push(p);
    else groups["Manual"].push(p);
  }

  if (loading) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading provider access…
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Override which payment providers this merchant may configure. Unset = follows subscription
        package. Disabled here overrides the package.
      </p>
      <div className="space-y-4">
        {Object.entries(groups).map(([label, list]) =>
          list.length === 0 ? null : (
            <div key={label}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((p) => {
                  const override = Object.prototype.hasOwnProperty.call(grants, p.id);
                  const enabled = grants[p.id] ?? true;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.label}</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {p.id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {override ? (
                          <button
                            className="text-[11px] text-muted-foreground underline hover:text-foreground"
                            onClick={() => reset(p.id)}
                            disabled={busy === p.id}
                          >
                            reset
                          </button>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            pkg
                          </Badge>
                        )}
                        <Switch
                          checked={enabled}
                          disabled={busy === p.id}
                          onCheckedChange={(v) => toggle(p.id, v)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}
