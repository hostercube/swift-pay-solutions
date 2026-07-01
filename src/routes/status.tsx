import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, AlertCircle, XCircle, Activity } from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "System Status · PayNOC" },
      { name: "description", content: "Real-time status of PayNOC checkout, API, webhooks and dashboard." },
      { property: "og:title", content: "PayNOC System Status" },
      { property: "og:description", content: "Live uptime and incident history for PayNOC services." },
    ],
  }),
  component: StatusPage,
});

type Incident = {
  id: string;
  title: string;
  body: string | null;
  severity: "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  components: string[];
  started_at: string;
  resolved_at: string | null;
};

const COMPONENTS = [
  { key: "checkout", label: "Hosted Checkout" },
  { key: "api", label: "REST API" },
  { key: "webhooks", label: "Webhooks" },
  { key: "dashboard", label: "Merchant Dashboard" },
  { key: "database", label: "Database" },
];

const SEV_COLOR: Record<string, string> = {
  minor: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  major: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  critical: "bg-red-500/10 text-red-600 border-red-500/30",
};

function StatusPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fromLoose = supabase.from as unknown as (t: string) => {
      select: (s: string) => {
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: Incident[] | null }>;
        };
      };
    };
    fromLoose("incidents")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setIncidents(data ?? []);
        setLoading(false);
      });
  }, []);

  const active = incidents.filter((i) => i.status !== "resolved");
  const affected = new Set(active.flatMap((i) => i.components));

  // Uptime: 90 days minus resolved incident durations
  const now = Date.now();
  const windowMs = 90 * 86_400_000;
  let downMs = 0;
  for (const i of incidents) {
    const start = new Date(i.started_at).getTime();
    const end = i.resolved_at ? new Date(i.resolved_at).getTime() : now;
    if (end < now - windowMs) continue;
    const clampedStart = Math.max(start, now - windowMs);
    const weight = i.severity === "critical" ? 1 : i.severity === "major" ? 0.5 : 0.1;
    downMs += Math.max(0, (end - clampedStart)) * weight;
  }
  const uptime = Math.max(0, 100 - (downMs / windowMs) * 100);
  const overallOk = active.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className={`mb-8 border-2 p-6 ${overallOk ? "border-green-500/40 bg-green-500/5" : "border-orange-500/40 bg-orange-500/5"}`}>
          <div className="flex items-center gap-4">
            {overallOk ? (
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-orange-500" />
            )}
            <div>
              <h1 className="font-display text-2xl font-bold">
                {overallOk ? "All systems operational" : `${active.length} active incident${active.length > 1 ? "s" : ""}`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Last checked {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="mb-8 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h2 className="font-medium">Components</h2>
            <span className="ml-auto text-xs text-muted-foreground">90-day uptime: {uptime.toFixed(2)}%</span>
          </div>
          <div className="divide-y divide-glass-border">
            {COMPONENTS.map((c) => {
              const down = affected.has(c.key);
              return (
                <div key={c.key} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium">{c.label}</span>
                  {down ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" /> Degraded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Operational
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div>
          <h2 className="mb-4 font-display text-xl font-semibold">Incident history</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : incidents.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No incidents reported. Everything's been running smoothly.
            </Card>
          ) : (
            <div className="space-y-4">
              {incidents.map((i) => (
                <Card key={i.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={SEV_COLOR[i.severity]}>{i.severity}</Badge>
                    <Badge variant={i.status === "resolved" ? "outline" : "default"}>
                      {i.status === "resolved" ? (
                        <><CheckCircle2 className="mr-1 h-3 w-3" /> Resolved</>
                      ) : (
                        <><XCircle className="mr-1 h-3 w-3" /> {i.status}</>
                      )}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(i.started_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold">{i.title}</h3>
                  {i.body && <p className="mt-1 text-sm text-muted-foreground">{i.body}</p>}
                  {i.components.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {i.components.map((c) => (
                        <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-xs">{c}</span>
                      ))}
                    </div>
                  )}
                  {i.resolved_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Resolved {new Date(i.resolved_at).toLocaleString()} ·
                      duration {Math.round((new Date(i.resolved_at).getTime() - new Date(i.started_at).getTime()) / 60000)} min
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
