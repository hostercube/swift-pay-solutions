import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { logApiRequest } from "@/lib/api-log.server";

export const Route = createFileRoute("/api/public/v1/invoices/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status, auth.headers ?? {});
        const started = Date.now();

        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
        const { data, error } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", params.id)
          .eq("merchant_id", auth.merchantId)
          .maybeSingle();

        let res: Response;
        let err: string | null = null;
        if (error) { res = jsonResponse({ error: error.message }, 500); err = error.message; }
        else if (!data) { res = jsonResponse({ error: "Invoice not found" }, 404); err = "Not found"; }
        else {
          const origin = new URL(request.url).origin;
          res = jsonResponse({ data: { ...data, checkout_url: `${origin}/pay/${data.id}` } });
        }
        logApiRequest({
          merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
          status: res.status, startedAt: started, errorMessage: err,
        });
        return res;
      },
    },
  },
});
