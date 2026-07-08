import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateMerchant, adminImpersonate } from "@/lib/admin.functions";
import { UserPlus, LogIn } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/merchants")({
  head: () => ({ meta: [{ title: "Merchants · Admin" }] }),
  component: MerchantsPage,
});

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  status: string;
  created_at: string;
  is_super_admin?: boolean;
};

function MerchantsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: adminRoles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, business_name, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);
    if (error) toast.error(error.message);
    const admins = new Set((adminRoles ?? []).map((r) => r.user_id));
    setRows(((data ?? []) as Row[]).map((r) => ({ ...r, is_super_admin: admins.has(r.id) })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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


  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return (
      !q ||
      r.email.toLowerCase().includes(s) ||
      (r.business_name ?? "").toLowerCase().includes(s) ||
      (r.full_name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <AdminShell title="Merchants" subtitle="Approve, suspend, or review every merchant on the platform.">
      <div className="mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, business, or name…"
          className="w-full max-w-sm rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No merchants found.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.business_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.full_name || ""}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    {r.status !== "active" && (
                      <button onClick={() => setStatus(r.id, "active")} className="rounded-md border border-glass-border px-2 py-1 text-xs hover:bg-brand/10 hover:text-brand">
                        Activate
                      </button>
                    )}
                    {r.status !== "suspended" && (
                      <button onClick={() => setStatus(r.id, "suspended")} className="rounded-md border border-glass-border px-2 py-1 text-xs hover:bg-destructive/10 hover:text-destructive">
                        Suspend
                      </button>
                    )}
                    <button
                      onClick={() => toggleSuperAdmin(r.id, !!r.is_super_admin)}
                      className={`rounded-md border border-glass-border px-2 py-1 text-xs ${
                        r.is_super_admin ? "text-brand" : "hover:bg-brand/10 hover:text-brand"
                      }`}
                    >
                      {r.is_super_admin ? "Revoke super admin" : "Make super admin"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-brand/10 text-brand"
      : status === "suspended"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
