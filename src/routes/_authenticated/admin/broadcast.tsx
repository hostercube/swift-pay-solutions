import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { adminBroadcastNotification } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Megaphone, Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/broadcast")({
  head: () => ({ meta: [{ title: "Broadcast · Admin" }] }),
  component: BroadcastPage,
});

function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "active" | "suspended" | "kyc_pending">("all");
  const [sending, setSending] = useState(false);
  const fn = useServerFn(adminBroadcastNotification);

  async function send() {
    if (!title.trim() || !body.trim()) return toast.error("Title and body are required");
    if (!confirm(`Send this notification to "${audience}" merchants?`)) return;
    setSending(true);
    try {
      const r = await fn({ data: { title, body, audience } });
      toast.success(`Sent to ${r.sent} merchants`);
      setTitle("");
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setSending(false);
  }

  return (
    <AdminShell title="Broadcast" subtitle="Push an in-app notification to merchants — filtered by status or KYC state.">
      <Card className="max-w-2xl space-y-4 p-6">
        <div className="flex items-center gap-3 rounded-lg border border-glass-border bg-brand/5 p-3 text-sm">
          <Megaphone className="h-4 w-4 text-brand" />
          Broadcasts land in the merchant notification center and fire any per-merchant delivery channels.
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Audience</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["all","active","suspended","kyc_pending"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                  audience === a ? "border-brand bg-brand/10 text-brand" : "border-glass-border hover:bg-muted"
                }`}
              >{a.replace("_"," ")}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight" maxLength={160} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm"
            placeholder="What do merchants need to know?"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{body.length}/2000</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send broadcast
          </Button>
        </div>
      </Card>
    </AdminShell>
  );
}
