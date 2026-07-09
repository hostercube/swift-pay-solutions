import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

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
      .limit(1000)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const columns: DataTableColumn<Row>[] = [
    { key: "created_at", label: "Time", render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "action", label: "Action", render: (r) => <span className="font-medium">{r.action}</span> },
    { key: "resource", label: "Resource", render: (r) => <span className="text-muted-foreground">{r.resource ? `${r.resource}${r.resource_id ? `:${r.resource_id.slice(0, 8)}` : ""}` : "—"}</span> },
    { key: "actor_id", label: "Actor", render: (r) => <span className="text-muted-foreground">{r.actor_id?.slice(0, 8) ?? "system"}</span> },
    { key: "ip_address", label: "IP", render: (r) => <span className="text-muted-foreground">{r.ip_address ?? "—"}</span> },
  ];

  const filters: DataTableFilter<Row>[] = [
    {
      key: "action",
      label: "All actions",
      options: Array.from(new Set(rows.map((r) => r.action))).sort().map((a) => ({ value: a, label: a })),
      match: (r, v) => r.action === v,
    },
    {
      key: "resource",
      label: "All resources",
      options: Array.from(new Set(rows.map((r) => r.resource).filter(Boolean) as string[])).sort().map((a) => ({ value: a, label: a })),
      match: (r, v) => r.resource === v,
    },
  ];

  return (
    <AdminShell title="Audit logs" subtitle="Security-relevant events across the platform.">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No audit events yet."
        searchable={(r) => `${r.action} ${r.resource ?? ""} ${r.resource_id ?? ""} ${r.actor_id ?? ""} ${r.ip_address ?? ""}`}
        filters={filters}
        dateField={(r) => r.created_at}
        pageSize={50}
      />
    </AdminShell>
  );
}
