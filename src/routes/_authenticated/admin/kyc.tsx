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
import { adminReviewKyc, adminSetVerificationMode } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { FilteredList } from "@/components/filtered-list";


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
  const setModeFn = useServerFn(adminSetVerificationMode);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, email, business_name, kyc_status, kyc_id_type, kyc_id_number, kyc_business_type, kyc_address, kyc_documents, kyc_submitted_at",
      )
      .order("kyc_submitted_at", { ascending: false, nullsFirst: false })
      .limit(500);
    setRows((data ?? []) as Row[]);


    const { data: s } = await supabase.from("platform_settings").select("verification_mode").eq("id", 1).single();
    setMode(s?.verification_mode ?? "manual");
  };
  useEffect(() => { load(); }, []);

  const saveMode = async (m: string) => {
    try {
      await setModeFn({ data: { mode: m as "manual" | "auto" } });
      toast.success(`Verification mode: ${m}`);
      setMode(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
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

      <FilteredList
        rows={rows}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.email} ${r.business_name ?? ""} ${r.kyc_id_number ?? ""}`}
        filters={[
          {
            key: "kyc",
            label: "All KYC states",
            options: [
              { value: "unverified", label: "Unverified" },
              { value: "pending", label: "Pending review" },
              { value: "verified", label: "Verified" },
              { value: "rejected", label: "Rejected" },
            ],
            match: (r, v) => (r.kyc_status ?? "unverified") === v,
          },
          {
            key: "biz",
            label: "All business types",
            options: Array.from(new Set(rows.map((r) => r.kyc_business_type).filter(Boolean) as string[])).map((b) => ({ value: b, label: b })),
            match: (r, v) => r.kyc_business_type === v,
          },
        ]}
        dateField={(r) => r.kyc_submitted_at}
        emptyMessage="No KYC submissions."
        render={(r) => <KycRow row={r} onDecide={decide} onDoc={docUrl} />}
      />
    </AdminShell>

  );
}

function KycRow({
  row, onDecide, onDoc,
}: { row: Row; onDecide: (id: string, d: "verified" | "rejected", note: string) => void; onDoc: (p: string) => void }) {
  const [note, setNote] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        (row.kyc_documents ?? []).map(async (d) => {
          const { data } = await supabase.storage.from("kyc").createSignedUrl(d.path, 600);
          return [d.path, data?.signedUrl ?? ""] as const;
        }),
      );
      setUrls(Object.fromEntries(entries));
    })();
  }, [row.id]);

  const isImage = (name: string) => /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(name);

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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {row.kyc_documents.map((d, i) => {
            const url = urls[d.path];
            return (
              <div key={i} className="rounded-lg border border-glass-border p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">{d.type ?? "Document"}</Badge>
                  <button className="text-xs text-brand hover:underline" onClick={() => onDoc(d.path)}>Open</button>
                </div>
                {url && isImage(d.name) ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={d.name} className="h-40 w-full rounded-md object-cover" />
                  </a>
                ) : url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block truncate rounded-md bg-muted/50 p-6 text-center text-xs text-muted-foreground">
                    {d.name}
                  </a>
                ) : (
                  <div className="h-40 animate-pulse rounded-md bg-muted/40" />
                )}
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{d.name}</div>
              </div>
            );
          })}
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
