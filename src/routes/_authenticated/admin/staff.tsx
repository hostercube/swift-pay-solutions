import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, Save } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_PERM_GROUPS } from "@/lib/permissions";
import { FilteredList } from "@/components/filtered-list";


export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [{ title: "Admin staff · PayNOC" }] }),
  component: AdminStaffPage,
});

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  permissions: string[];
  status: string;
  created_at: string;
};

function AdminStaffPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("admin_staff")
      .select("id, email, full_name, permissions, status, created_at")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("admin_staff").insert({
      email: email.trim().toLowerCase(),
      full_name: name.trim() || null,
      permissions: newPerms,
      invited_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Staff invited");
    setEmail(""); setName(""); setNewPerms([]);
    load();
  };

  const savePerms = async (id: string, perms: string[]) => {
    const { error } = await supabase.from("admin_staff").update({ permissions: perms }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await supabase.from("admin_staff").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminShell title="Admin office staff" subtitle="Invite office employees and grant granular per-area access.">
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="employee@paynoc.bd" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PermissionMatrix value={newPerms} onChange={setNewPerms} />
        <div className="mt-4 flex justify-end">
          <Button onClick={invite} disabled={busy || !email.trim()}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Invite staff
          </Button>
        </div>
      </Card>

      <div className="mt-6">
        <FilteredList
          rows={rows}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.email} ${r.full_name ?? ""} ${r.permissions.join(" ")}`}
          filters={[
            { key: "status", label: "All statuses", options: [{ value: "invited", label: "Invited" }, { value: "active", label: "Active" }, { value: "revoked", label: "Revoked" }], match: (r, v) => r.status === v },
          ]}
          dateField={(r) => r.created_at}
          emptyMessage="No admin staff yet"
          render={(r) => <StaffRow row={r} onSave={savePerms} onRemove={remove} />}
        />
      </div>
    </AdminShell>
  );
}


function PermissionMatrix({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((p) => p !== key) : [...value, key]);
  const toggleGroup = (keys: string[], on: boolean) => {
    if (on) onChange(Array.from(new Set([...value, ...keys])));
    else onChange(value.filter((v) => !keys.includes(v)));
  };
  return (
    <div className="mt-5 space-y-4">
      {ADMIN_PERM_GROUPS.map((g) => {
        const keys = g.perms.map((p) => p.key);
        const allOn = keys.every((k) => value.includes(k));
        const someOn = keys.some((k) => value.includes(k));
        return (
          <div key={g.group} className="rounded-lg border border-glass-border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand">{g.group}</span>
              <button
                type="button"
                onClick={() => toggleGroup(keys, !allOn)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                {allOn ? "Clear group" : someOn ? "Select all" : "Select group"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.perms.map((p) => (
                <label key={p.key} className="flex items-center gap-2 rounded-md border border-glass-border px-3 py-1.5 text-sm">
                  <Checkbox checked={value.includes(p.key)} onCheckedChange={() => toggle(p.key)} />
                  <span className="flex-1">{p.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StaffRow({
  row, onSave, onRemove,
}: { row: Row; onSave: (id: string, perms: string[]) => void; onRemove: (id: string) => void }) {
  const [perms, setPerms] = useState<string[]>(row.permissions ?? []);
  const dirty = JSON.stringify([...perms].sort()) !== JSON.stringify([...(row.permissions ?? [])].sort());

  useEffect(() => setPerms(row.permissions ?? []), [row]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{row.full_name ?? row.email}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{row.status}</Badge>
          <span className="text-xs text-muted-foreground">{perms.length} perms</span>
          <Button size="sm" variant="ghost" onClick={() => onRemove(row.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <PermissionMatrix value={perms} onChange={setPerms} />
      {dirty && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => onSave(row.id, perms)}>
            <Save className="mr-1.5 h-4 w-4" /> Save permissions
          </Button>
        </div>
      )}
    </Card>
  );
}
