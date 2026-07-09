/**
 * Server-only admin backend client that first installs the
 * `ws` WebSocket polyfill. Supabase's RealtimeClient throws
 * "Node.js 20 detected without native WebSocket support" during
 * `supabase.auth.admin.*` calls under Node.js < 22 (e.g. Coolify Node 20).
 * Import this module from every server fn / server route handler.
 */
import "@/lib/ws-polyfill.server";
import { createClient } from "@supabase/supabase-js";
import { requirePaynocBackendEnv } from "@/lib/paynoc-env.server";
import type { Database } from "@/integrations/supabase/types";

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createPaynocAdminClient() {
  const { url, serviceRoleKey } = requirePaynocBackendEnv([
    "url",
    "serviceRoleKey",
  ]);

  return createClient<Database>(url, serviceRoleKey, {
    global: { fetch: createSupabaseFetch(serviceRoleKey) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let adminClient: ReturnType<typeof createPaynocAdminClient> | undefined;

export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createPaynocAdminClient>,
  {
    get(_, prop, receiver) {
      if (!adminClient) adminClient = createPaynocAdminClient();
      return Reflect.get(adminClient, prop, receiver);
    },
  },
);
