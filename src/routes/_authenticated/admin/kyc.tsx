import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { adminReviewKyc } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({ meta: [{ title: "KYC review · Admin" }] }),
  component: KycPage,
});

type Doc = { name: string; path: string; type?: string };
type Row = {
  id: string;
  email: string;
  business_name: string | null;
  kyc_status: string;
  kyc_id_type: string | null;
  kyc_id_number: string | null;
  kyc_business_type: string | null;
  kyc_address: string | null;
  kyc_documents: Doc[];
  kyc_submitted_at: string | null;
};

function KycPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<string>("manual");
  const review = useServerFn(adminReviewKyc);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, email, business_name, kyc_status, kyc_id_type, kyc_id_number, kyc_business_type, kyc_address, kyc_documents, kyc_submitted_at",
      )
      .in("kyc_status", ["pending", "unverified"])
      .order("kyc_submitted_at", { ascending: false, nullsFirst: false });
    setRows((data ?? []) as Row[]);

    const { data: s } = await supabase.from("platform_settings").select("verification_mode").eq("id", 1).single();
    setMode(s?.verification_mode ?? "manual");
  };
  useEffect(() => { load(); }, []);

  const saveMode = async (m: string) => {
    const { error } = await supabase.from("platform_settings").update({ verification_mode: m }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success(`Verification mode: ${m}`);
    setMode(m);
  };

  const decide = async (id: string, decision: "verified" | "rejected", note: string) => {
    try {
      await review({ data: { merchant_id: id, decision, note } });
      toast.success(`Marked ${decision}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const docUrl = async (path: string) => {
    const { data } = await supabase.storage.from("kyc").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <AdminShell title="KYC review" subtitle="Approve or reject merchant verification submissions.">
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm font-semibold">Verification mode</div>
          <div className="text-xs text-muted-foreground">
            Auto: new signups are instantly verified. Manual: super admin reviews each merchant.
          </div>
        </div>
        <div className="flex gap-2">
          {["manual", "auto"].map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => saveMode(m)}>
              {m}
            </Button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No pending KYC submissions.</Card>
      ) : (
        <div className="space-y-4">{rows.map((r) => <KycRow key={r.id} row={r} onDecide={decide} onDoc={docUrl} />)}</div>
      )}
    </AdminShell>
  );
}

function KycRow({
  row, onDecide, onDoc,
}: { row: Row; onDecide: (id: string, d: "verified" | "rejected", note: string) => void; onDoc: (p: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{row.business_name || row.email}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
        <Badge variant="outline" className="capitalize">{row.kyc_status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <div><span className="text-muted-foreground">ID type: </span>{row.kyc_id_type || "—"}</div>
        <div><span className="text-muted-foreground">ID number: </span>{row.kyc_id_number || "—"}</div>
        <div><span className="text-muted-foreground">Business type: </span>{row.kyc_business_type || "—"}</div>
        <div><span className="text-muted-foreground">Address: </span>{row.kyc_address || "—"}</div>
      </div>
      {row.kyc_documents?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.kyc_documents.map((d, i) => (
            <Button key={i} size="sm" variant="outline" onClick={() => onDoc(d.path)}>{d.name}</Button>
          ))}
        </div>
      )}
      <Textarea className="mt-3" placeholder="Reviewer note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onDecide(row.id, "rejected", note)}>Reject</Button>
        <Button onClick={() => onDecide(row.id, "verified", note)}>Verify</Button>
      </div>
    </Card>
  );
}
