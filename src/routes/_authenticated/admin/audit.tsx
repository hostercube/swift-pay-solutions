import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit logs · Admin" }] }),
  component: AuditPage,
});

type Row = {
  id: string;
  actor_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string;
};

function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, resource, resource_id, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  return (
    <AdminShell title="Audit logs" subtitle="Latest 200 security-relevant events across the platform.">
      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit events yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.resource ? `${r.resource}${r.resource_id ? `:${r.resource_id.slice(0, 8)}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.actor_id?.slice(0, 8) ?? "system"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
