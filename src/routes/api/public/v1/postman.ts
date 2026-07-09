import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/postman")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const baseUrl = origin.includes("localhost") || origin.includes("lovable")
          ? "https://paynoc.bd"
          : origin;
        const collection = {
          info: {
            _postman_id: "paynoc-v1",
            name: "PayNOC API v1",
            description: "Official PayNOC merchant REST API collection. Set `baseUrl` and `apiKey` variables.",
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
          },
          variable: [
            { key: "baseUrl", value: baseUrl, type: "string" },
            { key: "apiKey", value: "sk_test_replace_me", type: "string" },
          ],
          auth: {
            type: "bearer",
            bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }],
          },
          item: [
            {
              name: "Create invoice",
              request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                url: { raw: "{{baseUrl}}/api/public/v1/invoices", host: ["{{baseUrl}}"], path: ["api", "public", "v1", "invoices"] },
                body: {
                  mode: "raw",
                  raw: JSON.stringify(
                    { amount: 500, currency: "BDT", customer_email: "customer@example.com", metadata: { order_id: "ORD-1" } },
                    null,
                    2,
                  ),
                },
              },
            },
            {
              name: "Get invoice",
              request: {
                method: "GET",
                url: {
                  raw: "{{baseUrl}}/api/public/v1/invoices/:id",
                  host: ["{{baseUrl}}"],
                  path: ["api", "public", "v1", "invoices", ":id"],
                  variable: [{ key: "id", value: "inv_xxx" }],
                },
              },
            },
          ],
        };
        return new Response(JSON.stringify(collection, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-disposition": 'attachment; filename="paynoc.postman_collection.json"',
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
