import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, Save } from "lucide-react";
import { toast } from "sonner";
import { MERCHANT_PERMS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · PayNOC" }] }),
  component: TeamPage,
});

type Row = {
  id: string;
  member_email: string;
  role: string;
  status: string;
  invited_at: string;
  permissions: string[];
};

function TeamPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select("id, member_email, role, status, invited_at, permissions")
      .eq("merchant_id", user.id)
      .order("invited_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, [user]);

  const invite = async () => {
    if (!user || !email.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("team_members").insert({
      merchant_id: user.id,
      member_email: email.trim().toLowerCase(),
      role,
      permissions: newPerms,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite sent");
    setEmail(""); setNewPerms([]);
    load();
  };

  const savePerms = async (id: string, perms: string[]) => {
    const { error } = await supabase.from("team_members").update({ permissions: perms }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <MerchantShell title="Team members" subtitle="Invite teammates and pick exactly what they can access.">
      <Card className="p-5">
        <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <Input placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={invite} disabled={busy || !email.trim()}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Invite
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {MERCHANT_PERMS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-md border border-glass-border px-3 py-2 text-sm">
              <Checkbox
                checked={newPerms.includes(p.key)}
                onCheckedChange={() =>
                  setNewPerms((prev) => prev.includes(p.key) ? prev.filter((x) => x !== p.key) : [...prev, p.key])
                }
              />
              {p.label}
            </label>
          ))}
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No teammates yet</Card>
        ) : (
          rows.map((r) => <TeamRow key={r.id} row={r} onSave={savePerms} onRemove={remove} />)
        )}
      </div>
    </MerchantShell>
  );
}

function TeamRow({
  row, onSave, onRemove,
}: { row: Row; onSave: (id: string, perms: string[]) => void; onRemove: (id: string) => void }) {
  const [perms, setPerms] = useState<string[]>(row.permissions ?? []);
  const dirty = JSON.stringify([...perms].sort()) !== JSON.stringify([...(row.permissions ?? [])].sort());

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{row.member_email}</div>
          <div className="text-xs text-muted-foreground">
            Role: <span className="capitalize">{row.role}</span> · Invited {new Date(row.invited_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{row.status}</Badge>
          <Button size="sm" variant="ghost" onClick={() => onRemove(row.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {MERCHANT_PERMS.map((p) => (
          <label key={p.key} className="flex items-center gap-2 rounded-md border border-glass-border px-3 py-2 text-sm">
            <Checkbox
              checked={perms.includes(p.key)}
              onCheckedChange={() =>
                setPerms((prev) => prev.includes(p.key) ? prev.filter((x) => x !== p.key) : [...prev, p.key])
              }
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
