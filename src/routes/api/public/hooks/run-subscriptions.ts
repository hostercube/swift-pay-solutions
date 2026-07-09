import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { notifyPlatform } from "@/lib/smsnoc.server";
import { requirePaynocBackendEnv } from "@/lib/paynoc-env.server";

/**
 * Runs periodically (see db/cron/schedule.sql). Renews & expires subscriptions,
 * then sends reminder / renewed / expired notifications through SMS NOC.
 */
export const Route = createFileRoute("/api/public/hooks/run-subscriptions")({
  server: {
    handlers: {
      POST: async () => {
        const { url, serviceRoleKey: key } = requirePaynocBackendEnv([
          "url",
          "serviceRoleKey",
        ]);
        const sb = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const rpc = sb.rpc.bind(sb) as unknown as (fn: string) =>
          Promise<{ data: unknown; error: { message: string } | null }>;

        const [renewed, expired] = await Promise.all([
          rpc("renew_due_subscriptions"),
          rpc("expire_due_subscriptions"),
        ]);

        let notifiedRenewed = 0;
        let notifiedExpired = 0;
        let notifiedReminders = 0;

        // Grab recently-emitted subscription events (last hour) and fan out.
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentEvents } = await sb
          .from("subscription_events")
          .select("event_type, merchant_id, package_id, created_at")
          .in("event_type", ["renewed", "expired", "assigned"])
          .gte("created_at", oneHourAgo);

        for (const ev of recentEvents ?? []) {
          const [{ data: profile }, { data: pkg }] = await Promise.all([
            sb
              .from("profiles")
              .select("email, phone, full_name, business_name")
              .eq("id", (ev as { merchant_id: string }).merchant_id)
              .maybeSingle(),
            sb
              .from("subscription_packages")
              .select("name")
              .eq("id", (ev as { package_id: string }).package_id)
              .maybeSingle(),
          ]);
          if (!profile) continue;
          const map: Record<string, string> = {
            renewed: "subscription_renewed",
            expired: "subscription_expired",
            assigned: "package_purchased",
          };
          const eventName = map[(ev as { event_type: string }).event_type];
          if (!eventName) continue;

          await notifyPlatform({
            event: eventName,
            recipient: {
              email: (profile.email as string) || undefined,
              phone: (profile.phone as string) || undefined,
              name:
                ((profile.full_name as string) ||
                  (profile.business_name as string) ||
                  ""),
            },
            vars: {
              name: (profile.full_name as string) || "",
              package_name: (pkg?.name as string) || "",
            },
          });
          if (eventName === "subscription_renewed") notifiedRenewed++;
          else if (eventName === "subscription_expired") notifiedExpired++;
        }

        // Expiring-soon reminders: current_period_end in (now, now + 3d].
        const now = new Date();
        const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const { data: expiring } = await sb
          .from("merchant_subscriptions")
          .select(
            "id, merchant_id, package_id, current_period_end, status, auto_renew",
          )
          .in("status", ["active", "trialing"])
          .eq("auto_renew", false)
          .gt("current_period_end", now.toISOString())
          .lte("current_period_end", in3d.toISOString());

        for (const s of expiring ?? []) {
          const row = s as {
            merchant_id: string;
            package_id: string;
            current_period_end: string;
          };
          const [{ data: profile }, { data: pkg }] = await Promise.all([
            sb
              .from("profiles")
              .select("email, phone, full_name, business_name")
              .eq("id", row.merchant_id)
              .maybeSingle(),
            sb
              .from("subscription_packages")
              .select("name")
              .eq("id", row.package_id)
              .maybeSingle(),
          ]);
          if (!profile) continue;
          await notifyPlatform({
            event: "subscription_expiring",
            recipient: {
              email: (profile.email as string) || undefined,
              phone: (profile.phone as string) || undefined,
              name:
                ((profile.full_name as string) ||
                  (profile.business_name as string) ||
                  ""),
            },
            vars: {
              name: (profile.full_name as string) || "",
              package_name: (pkg?.name as string) || "",
              expires_at: new Date(row.current_period_end).toDateString(),
            },
          });
          notifiedReminders++;
        }

        return new Response(
          JSON.stringify({
            renewed: renewed.data ?? 0,
            expired: expired.data ?? 0,
            notified: {
              renewed: notifiedRenewed,
              expired: notifiedExpired,
              reminders: notifiedReminders,
            },
            error: renewed.error?.message || expired.error?.message || null,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
