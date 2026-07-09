import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MerchantShell } from "@/components/merchant-shell";
import { NotificationsTabs } from "@/components/notifications-tabs";
import { FilteredList } from "@/components/filtered-list";
import { Button } from "@/components/ui/button";
import { Bell, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({ meta: [{ title: "Notifications · PayNOC" }] }),
  component: NotificationsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All marked read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <MerchantShell
      title="Notifications"
      subtitle="Real-time alerts for payments, webhooks and account activity."
      actions={
        <Button variant="outline" onClick={() => markAll.mutate()}>
          <Check className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      }
    >
      <NotificationsTabs />
      {isLoading ? (
        <div className="rounded-2xl border border-glass-border bg-card/40 p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <FilteredList
          rows={items}
          rowKey={(n) => n.id}
          searchable={(n) => `${n.title} ${n.body ?? ""} ${n.event}`}
          dateField={(n) => n.created_at}
          pageSize={12}
          emptyMessage={
            <>
              <Bell className="mx-auto mb-3 h-8 w-8 opacity-50" />
              No notifications yet.
            </>
          }
          filters={[
            {
              key: "read",
              label: "Status",
              options: [
                { value: "unread", label: "Unread" },
                { value: "read", label: "Read" },
              ],
              match: (n, v) => (v === "unread" ? !n.read_at : !!n.read_at),
            },
            {
              key: "event",
              label: "Event",
              options: Array.from(new Set(items.map((n) => n.event))).map((e) => ({ value: e, label: e })),
              match: (n, v) => n.event === v,
            },
          ]}
          listClassName="divide-y divide-glass-border rounded-2xl border border-glass-border bg-card/40"
          render={(n) => {
            const meta = (n.metadata as { invoiceId?: string } | null) ?? {};
            return (
              <div className="flex items-start gap-4 p-4">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-muted" : "bg-brand"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                      {n.event}
                    </span>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {meta.invoiceId && (
                    <Link to="/invoices/$id" params={{ id: meta.invoiceId }} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}
    </MerchantShell>
  );
}
