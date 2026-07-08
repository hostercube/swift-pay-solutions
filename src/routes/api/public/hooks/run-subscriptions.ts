import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/run-subscriptions")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const sb = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const rpc = sb.rpc as unknown as (fn: string) =>
          Promise<{ data: unknown; error: { message: string } | null }>;
        const [renewed, expired] = await Promise.all([
          rpc("renew_due_subscriptions"),
          rpc("expire_due_subscriptions"),
        ]);
        return new Response(
          JSON.stringify({
            renewed: renewed.data ?? 0,
            expired: expired.data ?? 0,
            error: renewed.error?.message || expired.error?.message || null,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
