import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { verifyTransaction, rejectTransaction } from "@/lib/payments.functions";
import { byoVerifyTransaction } from "@/lib/byo-verify.functions";
import { useMerchantRole } from "@/hooks/use-merchant-role";


export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice · PayNOC" }] }),
  component: InvoiceDetailPage,
});

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  description: string | null;
  method_type: string | null;
  fee_amount: number;
  net_amount: number;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  merchant_id: string;

};

type Txn = {
  id: string;
  status: string;
  method_type: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  sender_number: string | null;
  sender_name: string | null;
  reference: string | null;
  provider_txn_id: string | null;
  note: string | null;
  created_at: string;
  verified_at: string | null;
};

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: i }, { data: t }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
      supabase.from("transactions").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
    ]);
    setInv((i ?? null) as Invoice | null);
    setTxns((t ?? []) as Txn[]);
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const verifyFn = useServerFn(verifyTransaction);
  const rejectFn = useServerFn(rejectTransaction);
  const autoVerifyFn = useServerFn(byoVerifyTransaction);
  async function autoVerify(t: { id: string }) {
    try {
      const r = await autoVerifyFn({ data: { transactionId: t.id } }) as { ok: boolean };
      if (r.ok) { toast.success("Auto-verified via gateway"); load(); }
      else toast.error("Gateway says: not completed");
    } catch (e) { toast.error((e as Error).message); }
  }
  const { can } = useMerchantRole(inv?.merchant_id as string | undefined);


  async function verify(t: Txn) {
    if (!inv) return;
    try {
      await verifyFn({ data: { transactionId: t.id } });
      toast.success("Payment verified — webhook dispatched");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
  }

  async function reject(t: Txn) {
    const note = prompt("Reason for rejection (optional):") ?? undefined;
    try {
      await rejectFn({ data: { transactionId: t.id, note } });
      toast.success("Transaction rejected");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    }
  }

  async function cancel() {
    if (!inv) return;
    if (!confirm("Cancel this invoice?")) return;
    const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Invoice cancelled");
    load();
  }

  const checkoutUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${id}` : "";

  return (
    <MerchantShell
      title={inv ? `Invoice ${inv.invoice_number}` : "Invoice"}
      subtitle={inv?.description || "Details, checkout link, and verification"}
      actions={
        <Link to="/invoices" className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
    >
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && !inv && <div className="text-sm text-muted-foreground">Invoice not found.</div>}
      {inv && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="glass rounded-2xl border border-glass-border p-6 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
                <div className="mt-1 font-display text-3xl font-bold">
                  {inv.currency} {Number(inv.amount).toLocaleString()}
                </div>
              </div>
              <StatusBadge status={inv.status} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info label="Customer">{inv.customer_name || "—"}</Info>
              <Info label="Email">{inv.customer_email || "—"}</Info>
              <Info label="Phone">{inv.customer_phone || "—"}</Info>
              <Info label="Method">{inv.method_type || "—"}</Info>
              <Info label="Fee">{inv.fee_amount ? `${inv.currency} ${inv.fee_amount}` : "—"}</Info>
              <Info label="Net">{inv.net_amount ? `${inv.currency} ${inv.net_amount}` : "—"}</Info>
              <Info label="Created">{new Date(inv.created_at).toLocaleString()}</Info>
              <Info label="Expires">{inv.expires_at ? new Date(inv.expires_at).toLocaleString() : "—"}</Info>
            </div>

            {inv.status !== "completed" && inv.status !== "cancelled" && (
              <div className="mt-6 flex justify-end">
                <button onClick={cancel} className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  Cancel invoice
                </button>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl border border-glass-border p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hosted checkout link
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-background/60 px-3 py-2 font-mono text-xs">{checkoutUrl}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Copied"); }}
                className="rounded-md border border-glass-border p-2 hover:bg-muted"
              ><Copy className="h-4 w-4" /></button>
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="rounded-md border border-glass-border p-2 hover:bg-muted">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Share this link with your customer. They can pick a payment method and submit proof of payment.
            </p>
          </div>

          <div className="glass rounded-2xl border border-glass-border p-6 lg:col-span-3">
            <h2 className="font-display text-lg font-semibold">Payment attempts</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Method</th>
                    <th className="px-2 py-2">Sender</th>
                    <th className="px-2 py-2">Reference / TxnID</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Submitted</th>
                    <th className="px-2 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.length === 0 && (
                    <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                      No payment attempts yet.
                    </td></tr>
                  )}
                  {txns.map((t) => (
                    <tr key={t.id} className="border-t border-glass-border">
                      <td className="px-2 py-2 uppercase">{t.method_type}</td>
                      <td className="px-2 py-2">
                        <div>{t.sender_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{t.sender_number || ""}</div>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {t.provider_txn_id || t.reference || "—"}
                      </td>
                      <td className="px-2 py-2 font-medium">{Number(t.gross_amount).toLocaleString()}</td>
                      <td className="px-2 py-2"><StatusBadge status={t.status} /></td>
                      <td className="px-2 py-2 text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">
                        {t.status === "pending" ? (
                          can("operator") ? (
                            <div className="inline-flex gap-2">
                              {["bkash","nagad"].includes(String(t.method_type).toLowerCase()) && (
                                <button onClick={() => autoVerify(t)} className="rounded-md border border-brand/30 px-2 py-1 text-xs text-brand">
                                  Auto-verify
                                </button>
                              )}
                              <button onClick={() => verify(t)} className="rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                                Verify
                              </button>
                              <button onClick={() => reject(t)} className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive">
                                Reject
                              </button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">View only</span>
                        ) : "—"}

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "verified" ? "bg-brand/10 text-brand" :
    status === "failed" || status === "cancelled" || status === "expired" || status === "rejected" ? "bg-destructive/10 text-destructive" :
    status === "processing" ? "bg-amber-500/10 text-amber-500" :
    "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
