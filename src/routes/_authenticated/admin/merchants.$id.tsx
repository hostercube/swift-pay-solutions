import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useServerFn } from "@tanstack/react-start";
import {
  adminGetMerchantOverview,
  adminUpdateMerchant,
  adminSetMerchantStatus,
  adminSendPasswordReset,
  adminReviewKyc,
  adminImpersonate,
  adminDeleteMerchant,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  LogIn,
  ShieldOff,
  ShieldCheck,
  KeyRound,
  Save,
  Trash2,
  Copy,
  Loader2,
  Ban,
  Play,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/merchants/$id")({
  head: () => ({ meta: [{ title: "Merchant · Admin" }] }),
  component: MerchantDetailPage,
});

type Overview = Awaited<ReturnType<typeof adminGetMerchantOverview>>;

function MerchantDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const getFn = useServerFn(adminGetMerchantOverview);
  const updateFn = useServerFn(adminUpdateMerchant);
  const statusFn = useServerFn(adminSetMerchantStatus);
  const pwFn = useServerFn(adminSendPasswordReset);
  const kycFn = useServerFn(adminReviewKyc);
  const impersonateFn = useServerFn(adminImpersonate);
  const deleteFn = useServerFn(adminDeleteMerchant);

  const load = async () => {
    setLoading(true);
    try {
      const d = await getFn({ data: { merchant_id: id } });
      setData(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [id]);

  if (loading || !data?.profile) {
    return (
      <AdminShell title="Merchant" subtitle="Loading…">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading merchant…
        </div>
      </AdminShell>
    );
  }

  const p = data.profile as any;

  const setStatus = async (status: "active" | "suspended") => {
    if (!confirm(`Really ${status === "suspended" ? "suspend" : "reactivate"} this merchant?`)) return;
    try {
      await statusFn({ data: { merchant_id: id, status } });
      toast.success(`Merchant ${status}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const resetPw = async () => {
    try {
      const r = await pwFn({ data: { merchant_id: id, mode: "link" } });
      if (r.action_link) {
        await navigator.clipboard.writeText(r.action_link);
        toast.success("Recovery link copied to clipboard");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const impersonate = async () => {
    if (!confirm(`Sign in as ${p.email}?`)) return;
    try {
      const r = await impersonateFn({ data: { target_user_id: id } });
      if (r.action_link) window.open(r.action_link, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const overrideKyc = async (decision: "verified" | "rejected" | "unverified" | "pending") => {
    const note = decision === "rejected" ? prompt("Reason for rejection?") ?? undefined : undefined;
    try {
      await kycFn({ data: { merchant_id: id, decision, note } });
      toast.success(`KYC set to ${decision}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeAccount = async () => {
    if (!confirm(`Permanently delete ${p.email}? This cannot be undone.`)) return;
    if (!confirm("Are you absolutely sure?")) return;
    try {
      await deleteFn({ data: { merchant_id: id } });
      toast.success("Merchant deleted");
      navigate({ to: "/admin/merchants" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AdminShell title={p.business_name || p.email} subtitle={p.email}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/admin/merchants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to merchants
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <StatusBadge status={p.status} />
          <KycBadge status={p.kyc_status} />
          {data.is_super_admin && <Badge className="bg-brand/20 text-brand">Super Admin</Badge>}
        </div>
      </div>

      {/* Action bar */}
      <Card className="mb-6 flex flex-wrap gap-2 p-4">
        <Button size="sm" variant="outline" onClick={impersonate}>
          <LogIn className="mr-1.5 h-4 w-4" /> Login as
        </Button>
        <Button size="sm" variant="outline" onClick={resetPw}>
          <KeyRound className="mr-1.5 h-4 w-4" /> Reset password
        </Button>
        {p.status === "suspended" ? (
          <Button size="sm" variant="outline" onClick={() => setStatus("active")}>
            <Play className="mr-1.5 h-4 w-4" /> Reactivate
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setStatus("suspended")}>
            <Ban className="mr-1.5 h-4 w-4" /> Suspend
          </Button>
        )}
        <div className="mx-1 h-6 w-px bg-glass-border" />
        <Button size="sm" variant="outline" onClick={() => overrideKyc("verified")}>
          <ShieldCheck className="mr-1.5 h-4 w-4" /> Force-verify KYC
        </Button>
        <Button size="sm" variant="outline" onClick={() => overrideKyc("rejected")}>
          <ShieldOff className="mr-1.5 h-4 w-4" /> Reject KYC
        </Button>
        <Button size="sm" variant="outline" onClick={() => overrideKyc("pending")}>
          Reset KYC
        </Button>
        <div className="ml-auto">
          <Button size="sm" variant="destructive" onClick={removeAccount}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </Card>

      {/* Stat grid */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoices" value={data.counts.invoices} sub={`${data.counts.invoices_paid} paid`} />
        <Stat label="Transactions" value={data.counts.transactions} sub={`${data.counts.transactions_verified} verified`} />
        <Stat label="Gross volume" value={`৳ ${Number(data.counts.gross_volume).toLocaleString()}`} />
        <Stat
          label="Webhooks"
          value={data.counts.webhooks_delivered + data.counts.webhooks_failed}
          sub={`${data.counts.webhooks_failed} failed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileEditor merchant={p} onSave={updateFn} onDone={load} merchantId={id} />

          <Section title="Payment methods">
            {data.methods.length === 0 ? (
              <Empty>No configured methods.</Empty>
            ) : (
              <ul className="space-y-2">
                {data.methods.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium capitalize">{String(m.type).replace(/_/g, " ")}</span>{" "}
                      <span className="text-muted-foreground">— {m.label}</span>
                    </span>
                    <Badge variant={m.is_active ? "default" : "outline"}>{m.is_active ? "Active" : "Off"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="BYO gateways">
            {data.byo_gateways.length === 0 ? (
              <Empty>No BYO gateway credentials.</Empty>
            ) : (
              <ul className="space-y-2">
                {data.byo_gateways.map((g) => (
                  <li key={g.id} className="flex items-center justify-between rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm">
                    <span className="font-medium capitalize">{g.provider}</span>
                    <Badge variant={g.is_active ? "default" : "outline"}>{g.is_active ? "Active" : "Off"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Recent invoices (${data.recent_invoices.length})`}>
            {data.recent_invoices.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <div className="overflow-hidden rounded-lg border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_invoices.map((i) => (
                      <tr key={i.id} className="border-t border-glass-border">
                        <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                        <td className="px-3 py-2">{i.currency} {Number(i.amount).toLocaleString()}</td>
                        <td className="px-3 py-2 capitalize">{i.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={`Recent payouts (${data.recent_payouts.length})`}>
            {data.recent_payouts.length === 0 ? (
              <Empty>No payouts.</Empty>
            ) : (
              <div className="overflow-hidden rounded-lg border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Requested</th>
                      <th className="px-3 py-2">Processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_payouts.map((p2) => (
                      <tr key={p2.id} className="border-t border-glass-border">
                        <td className="px-3 py-2">{p2.currency} {Number(p2.amount).toLocaleString()}</td>
                        <td className="px-3 py-2 capitalize">{p2.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p2.created_at ? new Date(p2.created_at).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p2.processed_at ? new Date(p2.processed_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="KYC">
            <dl className="space-y-2 text-sm">
              <Field label="Status" value={p.kyc_status} />
              <Field label="ID type" value={p.kyc_id_type} />
              <Field label="ID number" value={p.kyc_id_number} />
              <Field label="Business type" value={p.kyc_business_type} />
              <Field label="Address" value={p.kyc_address} />
              <Field label="Submitted" value={p.kyc_submitted_at ? new Date(p.kyc_submitted_at).toLocaleString() : "—"} />
              <Field label="Reviewed" value={p.kyc_reviewed_at ? new Date(p.kyc_reviewed_at).toLocaleString() : "—"} />
              <Field label="Reviewer note" value={p.kyc_reviewer_note} />
            </dl>
          </Section>

          <Section title={`API keys (${data.api_keys.length})`}>
            {data.api_keys.length === 0 ? (
              <Empty>No API keys.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.api_keys.map((k) => (
                  <li key={k.id} className="rounded-lg border border-glass-border bg-card/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{k.name}</span>
                      <Badge variant={k.is_active ? "default" : "outline"} className="capitalize">
                        {k.environment}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <span className="truncate">{k.public_key}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(k.public_key); toast.success("Copied"); }}
                        className="shrink-0 rounded p-1 hover:bg-muted"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Team (${data.team_members.length})`}>
            {data.team_members.length === 0 ? (
              <Empty>Solo merchant.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.team_members.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-glass-border bg-card/40 px-3 py-2">
                    <div>
                      <div className="font-medium">{t.member_email}</div>
                      <div className="text-xs capitalize text-muted-foreground">{t.role} · {t.status}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-glass-border bg-card/40 p-4 text-sm text-muted-foreground">{children}</p>;
}
function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 border-b border-glass-border/50 py-1.5">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right">{value ?? "—"}</dd>
    </div>
  );
}
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    suspended: "bg-destructive/15 text-destructive",
    pending: "bg-warning/15 text-warning",
  };
  return <Badge className={map[status] ?? "bg-muted"}>{status}</Badge>;
}
function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    rejected: "bg-destructive/15 text-destructive",
    unverified: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[status] ?? "bg-muted"}>KYC: {status}</Badge>;
}

/** Inline profile editor. */
function ProfileEditor({
  merchant,
  onSave,
  onDone,
  merchantId,
}: {
  merchant: any;
  onSave: ReturnType<typeof useServerFn<typeof adminUpdateMerchant>>;
  onDone: () => void;
  merchantId: string;
}) {
  const [form, setForm] = useState({
    full_name: merchant.full_name ?? "",
    business_name: merchant.business_name ?? "",
    phone: merchant.phone ?? "",
    slug: merchant.slug ?? "",
    brand_color: merchant.brand_color ?? "",
    logo_url: merchant.logo_url ?? "",
    support_email: merchant.support_email ?? "",
    checkout_footer: merchant.checkout_footer ?? "",
    public_bio: merchant.public_bio ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ data: { merchant_id: merchantId, patch: form } });
      toast.success("Profile updated");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setSaving(false);
  }

  return (
    <Section title="Profile & branding">
      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Labeled>
          <Labeled label="Business name"><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Labeled>
          <Labeled label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Labeled>
          <Labeled label="Public slug"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Labeled>
          <Labeled label="Support email"><Input value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} /></Labeled>
          <Labeled label="Brand color"><Input value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} placeholder="#22c55e" /></Labeled>
          <Labeled label="Logo URL"><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></Labeled>
          <Labeled label="Checkout footer"><Input value={form.checkout_footer} onChange={(e) => setForm({ ...form, checkout_footer: e.target.value })} /></Labeled>
        </div>
        <Labeled label="Public bio">
          <textarea
            value={form.public_bio}
            onChange={(e) => setForm({ ...form, public_bio: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm"
          />
        </Labeled>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </Card>
    </Section>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
