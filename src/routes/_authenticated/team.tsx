import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

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
};

function TeamPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select("id, member_email, role, status, invited_at")
      .eq("merchant_id", user.id)
      .order("invited_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  const invite = async () => {
    if (!user || !email.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("team_members").insert({
      merchant_id: user.id,
      member_email: email.trim().toLowerCase(),
      role,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite sent");
    setEmail("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <MerchantShell title="Team members" subtitle="Invite teammates to your merchant account">
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
      </Card>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invited</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No teammates yet</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-glass-border">
                  <td className="px-4 py-3">{r.member_email}</td>
                  <td className="px-4 py-3 capitalize">{r.role}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.invited_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </MerchantShell>
  );
}
