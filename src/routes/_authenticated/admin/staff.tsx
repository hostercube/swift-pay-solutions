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
import { ADMIN_PERMS } from "@/lib/permissions";

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

  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((p) => p !== key) : [...list, key];

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
    <AdminShell title="Admin office staff" subtitle="Invite employees and tick which areas they can access.">
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="employee@paynoc.bd" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {ADMIN_PERMS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-md border border-glass-border px-3 py-2 text-sm">
              <Checkbox
                checked={newPerms.includes(p.key)}
                onCheckedChange={() => setNewPerms((prev) => toggle(prev, p.key))}
              />
              {p.label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={invite} disabled={busy || !email.trim()}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Invite staff
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No admin staff yet</Card>
        ) : (
          rows.map((r) => <StaffRow key={r.id} row={r} onSave={savePerms} onRemove={remove} />)
        )}
      </div>
    </AdminShell>
  );
}

function StaffRow({
  row, onSave, onRemove,
}: { row: Row; onSave: (id: string, perms: string[]) => void; onRemove: (id: string) => void }) {
  const [perms, setPerms] = useState<string[]>(row.permissions ?? []);
  const dirty = JSON.stringify([...perms].sort()) !== JSON.stringify([...(row.permissions ?? [])].sort());

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{row.full_name ?? row.email}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{row.status}</Badge>
          <Button size="sm" variant="ghost" onClick={() => onRemove(row.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {ADMIN_PERMS.map((p) => (
          <label key={p.key} className="flex items-center gap-2 rounded-md border border-glass-border px-3 py-2 text-sm">
            <Checkbox
              checked={perms.includes(p.key)}
              onCheckedChange={() => setPerms((prev) => prev.includes(p.key) ? prev.filter((x) => x !== p.key) : [...prev, p.key])}
            />
            {p.label}
          </label>
        ))}
      </div>
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
