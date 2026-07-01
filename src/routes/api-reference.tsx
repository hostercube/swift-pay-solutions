import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [
      { title: "API Reference · PayNOC" },
      { name: "description", content: "REST API reference for PayNOC — create invoices, fetch payments, and receive HMAC-signed webhooks." },
    ],
  }),
  component: ApiReferencePage,
});

const BASE = "https://api.paynoc.example/v1";

const CURL_CREATE = `curl -X POST ${BASE}/invoices \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1500,
    "currency": "BDT",
    "customer_name": "Rakib",
    "customer_email": "rakib@example.com",
    "description": "Order #4021",
    "redirect_url": "https://yourshop.com/thanks",
    "webhook_url": "https://yourshop.com/hooks/paynoc",
    "expires_in_hours": 24
  }'`;

const JS_CREATE = `const res = await fetch("${BASE}/invoices", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ amount: 1500, currency: "BDT", customer_email: "rakib@example.com" }),
});
const { data } = await res.json();
window.location.href = data.checkout_url;`;

const WEBHOOK_JS = `import { createHmac, timingSafeEqual } from "crypto";

app.post("/hooks/paynoc", (req, res) => {
  const sig = req.header("x-paynoc-signature") ?? "";
  const ts = req.header("x-paynoc-timestamp") ?? "";
  const body = req.rawBody;
  const expected = createHmac("sha256", process.env.PAYNOC_SECRET)
    .update(\`\${ts}.\${body}\`).digest("hex");
  const v1 = sig.split(",").find(p => p.startsWith("v1="))?.slice(3) ?? "";
  if (!timingSafeEqual(Buffer.from(v1), Buffer.from(expected)))
    return res.status(401).send("bad sig");
  // event verified
  const event = JSON.parse(body);
  console.log(event.event, event.data.invoice_number);
  res.send("ok");
});`;

function Code({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-glass-border bg-card/60 p-4 font-mono text-xs leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

function ApiReferencePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm text-brand">REST API v1</p>
          <h1 className="mt-2 font-display text-4xl">PayNOC API Reference</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            HTTPS, JSON, and predictable errors. Authenticate every request with your secret key,
            listen for HMAC-signed webhooks, and go live in minutes.
          </p>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Base URL</p>
              <p className="mt-1 font-mono text-sm">{BASE}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Auth</p>
              <p className="mt-1 font-mono text-sm">Authorization: Bearer sk_live_…</p>
            </Card>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl">Create an invoice</h2>
            <p className="mt-1 text-sm text-muted-foreground">POST /invoices — returns a hosted checkout URL.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">cURL</p>
                <Code code={CURL_CREATE} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">JavaScript</p>
                <Code code={JS_CREATE} />
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl">List / retrieve</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Code code={`GET ${BASE}/invoices?limit=25`} />
              <Code code={`GET ${BASE}/invoices/:id`} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl">Webhooks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every event is POSTed with a signed header{" "}
              <span className="font-mono">x-paynoc-signature: t=&lt;ts&gt;,v1=&lt;hmac_sha256(secret, "ts.body")&gt;</span>.
              Verify before trusting the payload.
            </p>
            <div className="mt-4">
              <Code code={WEBHOOK_JS} />
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li><span className="font-mono">invoice.created</span> — new invoice created via API</li>
              <li><span className="font-mono">invoice.completed</span> — payment verified</li>
              <li><span className="font-mono">invoice.failed</span> — payment rejected</li>
              <li><span className="font-mono">payout.processed</span> — payout processed by admin</li>
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl">Rate limits & security</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>120 requests / minute per API key (HTTP 429 on exceed).</li>
              <li>Optional IP whitelist per merchant — configure in dashboard.</li>
              <li>All calls audit-logged with IP + user agent.</li>
            </ul>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
