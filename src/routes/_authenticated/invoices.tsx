import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, ExternalLink, Copy, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices · PayNOC" }] }),
  component: InvoicesPage,
});

type Row = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  created_at: string;
  mode: string;
};

function InvoicesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<"all" | "live" | "test">("all");

  useEffect(() => {
    if (!user) return;
    let q = supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, customer_name, customer_email, status, created_at, mode")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (modeFilter !== "all") q = q.eq("mode", modeFilter);
    q.then(({ data }) => {
      setRows((data ?? []) as Row[]);
      setLoading(false);
    });
  }, [user, modeFilter]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function copyLink(id: string) {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Checkout link copied");
  }

  function exportCsv() {
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const header = ["invoice_number","amount","currency","customer_name","customer_email","status","mode","created_at"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.join(","), ...rows.map((r) => header.map((h) => esc((r as Record<string, unknown>)[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoices-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const parseLine = (line: string) => {
      const out: string[] = []; let cur = ""; let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') { q = false; }
          else cur += c;
        } else {
          if (c === '"') q = true;
          else if (c === ",") { out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((l) => {
      const cells = parseLine(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
  }

  async function importCsv(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { toast.error("CSV is empty"); return; }
      const payload = parsed.map((r) => ({
        merchant_id: user.id,
        amount: Number(r.amount || 0),
        currency: r.currency || "BDT",
        customer_name: r.customer_name || null,
        customer_email: r.customer_email || null,
        customer_phone: r.customer_phone || null,
        description: r.description || null,
        redirect_url: r.redirect_url || null,
        mode: (r.mode === "test" ? "test" : "live") as "test" | "live",
        status: "pending" as const,
        invoice_number: r.invoice_number || `INV-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      }));
      const invalid = payload.filter((p) => !p.amount || p.amount <= 0);
      if (invalid.length) { toast.error(`${invalid.length} row(s) missing amount`); return; }
      const { error } = await supabase.from("invoices").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(`Imported ${payload.length} invoice(s)`);
      setModeFilter((m) => m);
      const { data } = await supabase.from("invoices")
        .select("id, invoice_number, amount, currency, customer_name, customer_email, status, created_at, mode")
        .eq("merchant_id", user.id).order("created_at", { ascending: false }).limit(100);
      setRows((data ?? []) as Row[]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <MerchantShell
      title="Invoices"
      subtitle="Create payment requests and share checkout links with your customers."
      actions={
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm font-semibold text-foreground hover:bg-card/60 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {busy ? "Importing…" : "Import CSV"}
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm font-semibold text-foreground hover:bg-card/60"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
          >
            <Plus className="h-4 w-4" /> New invoice
          </Link>
        </div>
      }
    >
      <div className="mb-4 inline-flex rounded-lg border border-glass-border bg-card/40 p-1 text-xs">
        {(["all","live","test"] as const).map((m) => (
          <button key={m} onClick={() => setModeFilter(m)}
            className={`rounded-md px-3 py-1.5 font-semibold uppercase tracking-wider ${modeFilter===m ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">

            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Checkout</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                No invoices yet — click <span className="text-foreground">New invoice</span> to create one.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link to="/invoices/$id" params={{ id: r.id }} className="font-mono text-xs hover:text-brand">
                      {r.invoice_number}
                    </Link>
                    {r.mode === "test" && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">Test</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div>{r.customer_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.customer_email || ""}</div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {r.currency} {Number(r.amount).toLocaleString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => copyLink(r.id)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy checkout link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={`/pay/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Open checkout"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" ? "bg-brand/10 text-brand" :
    status === "failed" || status === "cancelled" || status === "expired" ? "bg-destructive/10 text-destructive" :
    status === "processing" ? "bg-amber-500/10 text-amber-500" :
    "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
