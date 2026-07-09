import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateMerchant, adminImpersonate } from "@/lib/admin.functions";
import { UserPlus, LogIn, ExternalLink, Eye } from "lucide-react";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/admin/merchants/")({
  head: () => ({ meta: [{ title: "Merchants · Admin" }] }),
  component: MerchantsPage,
});

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  status: string;
  kyc_status: string | null;
  created_at: string;
  is_super_admin?: boolean;
};

function MerchantsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: adminRoles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, business_name, status, kyc_status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);
    if (error) toast.error(error.message);
    const admins = new Set((adminRoles ?? []).map((r) => r.user_id));
    setRows(((data ?? []) as Row[]).map((r) => ({ ...r, is_super_admin: admins.has(r.id) })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Merchant ${status}`);
    load();
  }

  async function toggleSuperAdmin(userId: string, currentlyAdmin: boolean) {
    if (currentlyAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "super_admin");
      if (error) return toast.error(error.message);
      toast.success("Super admin revoked");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "super_admin" });
      if (error) return toast.error(error.message);
      toast.success("Super admin granted");
    }
    load();
  }

  const createFn = useServerFn(adminCreateMerchant);
  const impersonateFn = useServerFn(adminImpersonate);
  const [showCreate, setShowCreate] = useState(false);
  const [c, setC] = useState({ email: "", password: "", business_name: "", full_name: "", verified: true });

  async function createMerchant() {
    try {
      await createFn({ data: c });
      toast.success("Merchant created");
      setShowCreate(false);
      setC({ email: "", password: "", business_name: "", full_name: "", verified: true });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function impersonate(id: string, email: string) {
    if (!confirm(`Sign in as ${email}?\nA one-time link will open in a new tab.`)) return;
    try {
      const res = await impersonateFn({ data: { target_user_id: id } });
      if (res.action_link) window.open(res.action_link, "_blank");
      else toast.error("No link returned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: "business",
      label: "Business",
      sortable: true,
      accessor: (r) => r.business_name ?? "",
      render: (r) => (
        <Link to="/admin/merchants/$id" params={{ id: r.id }} className="group inline-flex items-center gap-1.5">
          <div>
            <div className="font-medium group-hover:text-brand">{r.business_name || "—"}</div>
            <div className="text-xs text-muted-foreground">{r.full_name || ""}</div>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        </Link>
      ),
    },
    { key: "email", label: "Email", sortable: true, accessor: (r) => r.email, render: (r) => <span className="text-muted-foreground">{r.email}</span> },
    { key: "status", label: "Status", sortable: true, accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "kyc_status", label: "KYC", sortable: true, accessor: (r) => r.kyc_status ?? "unverified", render: (r) => <KycBadge status={r.kyc_status ?? "unverified"} /> },
    { key: "created_at", label: "Joined", sortable: true, accessor: (r) => new Date(r.created_at), render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span> },
  ];

  const filters: DataTableFilter<Row>[] = [
    { key: "status", label: "All statuses", options: [{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }, { value: "suspended", label: "Suspended" }], match: (r, v) => r.status === v },
    { key: "kyc", label: "All KYC", options: [{ value: "verified", label: "Verified" }, { value: "pending", label: "KYC pending" }, { value: "rejected", label: "Rejected" }, { value: "unverified", label: "Unverified" }], match: (r, v) => (r.kyc_status ?? "unverified") === v },
    { key: "role", label: "Any role", options: [{ value: "admin", label: "Super admins" }, { value: "merchant", label: "Merchants only" }], match: (r, v) => (v === "admin" ? !!r.is_super_admin : !r.is_super_admin) },
  ];

  return (
    <AdminShell title="Merchants" subtitle="Approve, suspend, or review every merchant on the platform.">
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Create merchant
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
            <Input placeholder="Password (min 8)" type="text" value={c.password} onChange={(e) => setC({ ...c, password: e.target.value })} />
            <Input placeholder="Business name" value={c.business_name} onChange={(e) => setC({ ...c, business_name: e.target.value })} />
            <Input placeholder="Full name" value={c.full_name} onChange={(e) => setC({ ...c, full_name: e.target.value })} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.verified} onChange={(e) => setC({ ...c, verified: e.target.checked })} />
            Mark KYC as verified
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createMerchant} disabled={!c.email || c.password.length < 8}>Create</Button>
          </div>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No merchants found."
        searchable={(r) => `${r.email} ${r.business_name ?? ""} ${r.full_name ?? ""} ${r.id}`}
        filters={filters}
        dateField={(r) => r.created_at}
        pageSize={25}
        actions={(r) => (
          <div className="inline-flex flex-wrap justify-end gap-2">
            <Link to="/admin/merchants/$id" params={{ id: r.id }}
              className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/20">
              <Eye className="h-3 w-3" /> View
            </Link>
            {r.status !== "active" && (
              <button onClick={() => setStatus(r.id, "active")} className="rounded-md border border-glass-border px-2 py-1 text-xs hover:bg-brand/10 hover:text-brand">Activate</button>
            )}
            {r.status !== "suspended" && (
              <button onClick={() => setStatus(r.id, "suspended")} className="rounded-md border border-glass-border px-2 py-1 text-xs hover:bg-destructive/10 hover:text-destructive">Suspend</button>
            )}
            <button
              onClick={() => toggleSuperAdmin(r.id, !!r.is_super_admin)}
              className={`rounded-md border border-glass-border px-2 py-1 text-xs ${r.is_super_admin ? "text-brand" : "hover:bg-brand/10 hover:text-brand"}`}
            >
              {r.is_super_admin ? "Revoke admin" : "Make admin"}
            </button>
            <button onClick={() => impersonate(r.id, r.email)}
              className="inline-flex items-center gap-1 rounded-md border border-glass-border px-2 py-1 text-xs hover:bg-brand/10 hover:text-brand">
              <LogIn className="h-3 w-3" /> Login as
            </button>
          </div>
        )}
      />
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" ? "bg-brand/10 text-brand" :
    status === "suspended" ? "bg-destructive/10 text-destructive" :
    "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>{status}</span>;
}
function KycBadge({ status }: { status: string }) {
  const tone =
    status === "verified" ? "bg-brand/10 text-brand" :
    status === "rejected" ? "bg-destructive/10 text-destructive" :
    status === "pending" ? "bg-warning/10 text-warning" :
    "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>{status}</span>;
}
