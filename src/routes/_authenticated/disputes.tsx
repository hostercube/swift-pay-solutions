import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/disputes")({
  head: () => ({ meta: [{ title: "Disputes · PayNOC" }] }),
  component: DisputesPage,
});

type Row = {
  id: string;
  invoice_id: string;
  reason: string;
  status: string;
  evidence_url: string | null;
  merchant_note: string | null;
  admin_note: string | null;
  created_at: string;
};

const COLOR: Record<string, string> = {
  open: "bg-warning/15 text-warning",
  under_review: "bg-brand/15 text-brand",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

function DisputesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase.from as unknown as (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => Promise<{ data: Row[] | null }>;
        };
      };
    })("disputes")
      .select("*")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, [user]);

  const create = async () => {
    if (!user) return;
    if (!invoiceId.trim() || !reason.trim())
      return toast.error("Invoice ID and reason required");
    setBusy(true);
    const { error } = await (supabase.from as unknown as (t: string) => {
      insert: (r: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    })("disputes").insert({
      merchant_id: user.id,
      invoice_id: invoiceId.trim(),
      reason: reason.trim(),
      merchant_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dispute logged");
    setInvoiceId("");
    setReason("");
    setNote("");
    load();
  };

  const upload = async (disputeId: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/${disputeId}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("disputes").upload(path, file);
    if (error) return toast.error(error.message);
    await (supabase.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    })("disputes").update({ evidence_url: path }).eq("id", disputeId);
    toast.success("Evidence uploaded");
    load();
  };

  const view = async (path: string) => {
    const { data } = await supabase.storage.from("disputes").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const withdraw = async (id: string) => {
    await (supabase.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    })("disputes").update({ status: "withdrawn" }).eq("id", id);
    load();
  };

  return (
    <MerchantShell
      title="Disputes"
      subtitle="Log chargebacks and upload evidence files. Admins review status."
    >
      <Card className="p-5">
        <h3 className="mb-3 font-medium">Log a dispute</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Invoice ID (uuid)"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          />
          <Input
            placeholder="Reason (e.g. unauthorised)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Textarea
          className="mt-2"
          placeholder="Additional notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button className="mt-3" onClick={create} disabled={busy}>
          Create
        </Button>
      </Card>

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No disputes logged.</Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Invoice: {r.invoice_id}
                  </div>
                  <div className="mt-1 font-medium">{r.reason}</div>
                  {r.merchant_note && (
                    <div className="mt-1 text-sm text-muted-foreground">{r.merchant_note}</div>
                  )}
                  {r.admin_note && (
                    <div className="mt-1 text-sm text-brand">Admin: {r.admin_note}</div>
                  )}
                </div>
                <Badge className={COLOR[r.status] ?? ""}>{r.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
                {r.evidence_url && (
                  <button
                    onClick={() => view(r.evidence_url!)}
                    className="text-brand hover:underline"
                  >
                    View evidence
                  </button>
                )}
                <label className="cursor-pointer text-brand hover:underline">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(r.id, f);
                    }}
                  />
                  Upload evidence
                </label>
                {r.status !== "withdrawn" && (
                  <button
                    onClick={() => withdraw(r.id)}
                    className="text-destructive hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </MerchantShell>
  );
}
