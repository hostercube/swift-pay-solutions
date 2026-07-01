import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/invoices/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", params.id)
          .eq("merchant_id", auth.merchantId)
          .maybeSingle();

        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Invoice not found" }, 404);

        const origin = new URL(request.url).origin;
        return jsonResponse({ data: { ...data, checkout_url: `${origin}/pay/${data.id}` } });
      },
    },
  },
});
