import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { verifyMerchantDomain } from "@/lib/domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Copy, Trash2, RefreshCw, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/domains")({
  head: () => ({ meta: [{ title: "Custom Domains · PayNOC" }] }),
  component: DomainsPage,
});

type Domain = {
  id: string;
  domain: string;
  verify_token: string;
  verified_at: string | null;
  is_primary: boolean;
  use_for: "checkout" | "portal" | "all";
  created_at: string;
};

function DomainsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const verifyFn = useServerFn(verifyMerchantDomain);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("merchant_domains" as never)
      .select("id, domain, verify_token, verified_at, is_primary, use_for, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Domain[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function addDomain() {
    if (!user) return;
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) {
      toast.error("Enter a valid domain (e.g. pay.mystore.com)");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("merchant_domains" as never)
      .insert({ merchant_id: user.id, domain: clean } as never);
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewDomain("");
    toast.success("Domain added. Add the TXT record, then click Verify.");
    load();
  }

  async function removeDomain(id: string) {
    if (!confirm("Remove this domain?")) return;
    const { error } = await supabase.from("merchant_domains" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  async function verify(id: string) {
    setVerifyingId(id);
    try {
      const res = await verifyFn({ data: { domain_id: id } });
      if (res.ok) {
        toast.success(res.message);
        load();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <MerchantShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Custom Domains</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Serve hosted checkout, invoices, and customer portal under your own domain
            (white-label). Add a domain, verify it via a TXT record, then point an A/CNAME record
            to PayNOC.
          </p>
        </div>

        <Card className="p-5">
          <Label className="mb-2 block text-sm font-medium">Add a domain</Label>
          <div className="flex gap-2">
            <Input
              placeholder="pay.mystore.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
            />
            <Button onClick={addDomain} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Once verified, your customers will see PayNOC-hosted pages under your own domain — no
            PayNOC branding in the URL.
          </p>
        </Card>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No custom domains yet.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <Card key={d.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-semibold">{d.domain}</span>
                      {d.verified_at ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500">Verified</Badge>
                      ) : (
                        <Badge variant="outline">Pending verification</Badge>
                      )}
                    </div>

                    {!d.verified_at && (
                      <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-xs">
                        <div>
                          <p className="mb-1 font-medium text-foreground">
                            Step 1 — Add this TXT record at your DNS provider:
                          </p>
                          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 font-mono">
                            <span className="text-muted-foreground">Type</span>
                            <span>TXT</span>
                            <span className="text-muted-foreground">Name</span>
                            <span className="flex items-center gap-1">
                              {`_paynoc-verify.${d.domain}`}
                              <CopyBtn text={`_paynoc-verify.${d.domain}`} />
                            </span>
                            <span className="text-muted-foreground">Value</span>
                            <span className="flex items-center gap-1 break-all">
                              paynoc-verify={d.verify_token}
                              <CopyBtn text={`paynoc-verify=${d.verify_token}`} />
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 font-medium text-foreground">
                            Step 2 — Point traffic to PayNOC:
                          </p>
                          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 font-mono">
                            <span className="text-muted-foreground">Type</span>
                            <span>A</span>
                            <span className="text-muted-foreground">Name</span>
                            <span>{d.domain.split(".")[0]}</span>
                            <span className="text-muted-foreground">Value</span>
                            <span>185.158.133.1</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {!d.verified_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verify(d.id)}
                        disabled={verifyingId === d.id}
                      >
                        <RefreshCw
                          className={`mr-1 h-3.5 w-3.5 ${
                            verifyingId === d.id ? "animate-spin" : ""
                          }`}
                        />
                        Verify
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeDomain(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MerchantShell>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
      className="text-muted-foreground hover:text-foreground"
      aria-label="Copy"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}
