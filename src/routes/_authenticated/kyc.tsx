import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({ meta: [{ title: "Verify your business · PayNOC" }] }),
  component: KycPage,
});

type Doc = { name: string; path: string; type?: string };

const DOC_TYPES = [
  "NID",
  "Passport",
  "Driving Licence",
  "Trade Licence",
  "BIN",
  "TIN",
  "RJSC",
  "DBID",
  "Bank Statement",
  "Utility Bill",
  "Other",
];

function KycPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("unverified");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextType, setNextType] = useState<string>(DOC_TYPES[0]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("kyc_status, kyc_id_type, kyc_id_number, kyc_business_type, kyc_address, kyc_documents, kyc_reviewer_note")
      .eq("id", user.id)
      .single();
    if (!data) return;
    setStatus(data.kyc_status);
    setIdType(data.kyc_id_type ?? "");
    setIdNumber(data.kyc_id_number ?? "");
    setBusinessType(data.kyc_business_type ?? "");
    setAddress(data.kyc_address ?? "");
    setDocs((data.kyc_documents ?? []) as Doc[]);
    setNote(data.kyc_reviewer_note);
  };
  useEffect(() => { load(); }, [user]);

  const upload = async (f: File, type: string) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from("kyc").upload(path, f, { upsert: false });
    if (error) return toast.error(error.message);
    setDocs((d) => [...d, { name: f.name, path, type }]);
    toast.success(`${type} uploaded`);
  };

  const removeDoc = async (path: string) => {
    await supabase.storage.from("kyc").remove([path]);
    setDocs((d) => d.filter((x) => x.path !== path));
  };

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_id_type: idType || null,
        kyc_id_number: idNumber || null,
        kyc_business_type: businessType || null,
        kyc_address: address || null,
        kyc_documents: docs,
        kyc_status: "pending",
        kyc_submitted_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted for review");
    load();
  };

  const tone =
    status === "verified" ? "bg-brand/10 text-brand"
      : status === "rejected" ? "bg-destructive/10 text-destructive"
      : status === "pending" ? "bg-amber-500/10 text-amber-500"
      : "bg-muted text-muted-foreground";

  return (
    <MerchantShell title="Business verification" subtitle="Submit KYC documents to unlock live payouts.">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <span className="font-medium">Status</span>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${tone}`}>{status}</span>
        </div>
        {status === "rejected" && note && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <strong>Reviewer note: </strong>{note}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Primary ID type (NID / Passport)</label>
            <Input value={idType} onChange={(e) => setIdType(e.target.value)} disabled={status === "verified"} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">ID number</label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={status === "verified"} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Business type</label>
            <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} disabled={status === "verified"} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Business address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={status === "verified"} />
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs text-muted-foreground">
            Documents — upload any combination: NID/Passport, Driving Licence, Trade Licence, BIN/TIN/RJSC/DBID, or Other.
          </label>

          {docs.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {docs.map((d) => (
                <div key={d.path} className="flex items-center justify-between rounded-md border border-glass-border px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline">{d.type ?? "Other"}</Badge>
                    <span className="truncate">{d.name}</span>
                  </div>
                  {status !== "verified" && (
                    <button onClick={() => removeDoc(d.path)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {status !== "verified" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={nextType}
                onChange={(e) => setNextType(e.target.value)}
                className="rounded-md border border-glass-border bg-card/60 px-3 py-2 text-sm"
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-glass-border px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" /> Upload {nextType}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f, nextType);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {status !== "verified" && (
          <div className="mt-5 flex justify-end">
            <Button onClick={submit} disabled={busy || docs.length === 0}>
              Submit for review
            </Button>
          </div>
        )}
      </Card>
    </MerchantShell>
  );
}
