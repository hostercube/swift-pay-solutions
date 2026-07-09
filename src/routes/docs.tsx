import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Download, BookOpen, Github, Package } from "lucide-react";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "API Reference · PayNOC" },
      {
        name: "description",
        content:
          "Complete PayNOC REST API reference for developers — authentication, invoices, checkout, webhooks, refunds, errors, idempotency, and testing.",
      },
      { property: "og:title", content: "PayNOC API Reference" },
      {
        property: "og:description",
        content:
          "Developer-friendly REST API docs for PayNOC — create invoices, hosted checkout, HMAC webhooks, refunds, and payouts.",
      },
    ],
  }),
  component: ApiReferencePage,
});

const BASE = "https://paynoc.bd/api/public/v1";

/* ---------------------- code snippets ---------------------- */

const CURL_CREATE = `curl -X POST ${BASE}/invoices \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 8f14e45f-ceea-467a-9575-d0ab1af1b1e5" \\
  -d '{
    "amount": 1500,
    "currency": "BDT",
    "customer_name": "Rakib Hasan",
    "customer_email": "rakib@example.com",
    "customer_phone": "+8801710000000",
    "description": "Order #4021",
    "redirect_url": "https://yourshop.com/thanks",
    "webhook_url": "https://yourshop.com/hooks/paynoc",
    "expires_in_hours": 24,
    "metadata": { "order_id": "4021", "source": "checkout" }
  }'`;

const CURL_RETRIEVE = `curl ${BASE}/invoices/{invoice_id} \\
  -H "Authorization: Bearer sk_live_xxx"`;

const CURL_LIST = `curl "${BASE}/invoices?limit=25" \\
  -H "Authorization: Bearer sk_live_xxx"`;

const JS_CREATE = `const res = await fetch("${BASE}/invoices", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.PAYNOC_SECRET_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    amount: 1500,
    currency: "BDT",
    customer_email: "rakib@example.com",
    redirect_url: "https://yourshop.com/thanks",
    webhook_url: "https://yourshop.com/hooks/paynoc",
  }),
});

const { data } = await res.json();
window.location.href = data.checkout_url;`;

const PHP_CREATE = `<?php
$ch = curl_init("${BASE}/invoices");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("PAYNOC_SECRET_KEY"),
    "Content-Type: application/json",
    "Idempotency-Key: " . bin2hex(random_bytes(16)),
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "amount"       => 1500,
    "currency"     => "BDT",
    "customer_email" => "rakib@example.com",
    "redirect_url" => "https://yourshop.com/thanks",
    "webhook_url"  => "https://yourshop.com/hooks/paynoc",
  ]),
]);
$response = json_decode(curl_exec($ch), true);
header("Location: " . $response["data"]["checkout_url"]);`;

const PY_CREATE = `import os, uuid, requests

r = requests.post(
    "${BASE}/invoices",
    headers={
        "Authorization": f"Bearer {os.environ['PAYNOC_SECRET_KEY']}",
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "amount": 1500,
        "currency": "BDT",
        "customer_email": "rakib@example.com",
        "redirect_url": "https://yourshop.com/thanks",
        "webhook_url":  "https://yourshop.com/hooks/paynoc",
    },
)
data = r.json()["data"]
print(data["checkout_url"])`;

const RESP_INVOICE = `{
  "data": {
    "id": "inv_7f2b4c8a...",
    "invoice_number": "INV-20260708-A1B2C3",
    "amount": 1500,
    "currency": "BDT",
    "status": "pending",
    "mode": "live",
    "customer_name": "Rakib Hasan",
    "customer_email": "rakib@example.com",
    "customer_phone": "+8801710000000",
    "description": "Order #4021",
    "redirect_url": "https://yourshop.com/thanks",
    "webhook_url":  "https://yourshop.com/hooks/paynoc",
    "metadata": { "order_id": "4021" },
    "expires_at": "2026-07-09T12:00:00.000Z",
    "created_at": "2026-07-08T12:00:00.000Z",
    "paid_at": null,
    "checkout_url": "https://pay.paynoc.bd/inv_7f2b4c8a..."
  }
}`;

const WEBHOOK_PAYLOAD = `{
  "id": "evt_9a2f7c4e...",
  "event": "invoice.completed",
  "created": 1783512345,
  "mode": "live",
  "data": {
    "id": "inv_7f2b4c8a...",
    "invoice_number": "INV-20260708-A1B2C3",
    "amount": 1500,
    "currency": "BDT",
    "status": "completed",
    "customer_email": "rakib@example.com",
    "paid_at": "2026-07-08T12:03:11.000Z",
    "metadata": { "order_id": "4021" },
    "gateway": "bkash",
    "gateway_txn_id": "TRX12345XYZ"
  }
}`;

const WEBHOOK_NODE = `import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const app = express();
// IMPORTANT: preserve raw body to verify the signature
app.post(
  "/hooks/paynoc",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.header("x-paynoc-signature") ?? "";
    const ts  = req.header("x-paynoc-timestamp") ?? "";
    const raw = req.body.toString("utf8");

    const expected = createHmac("sha256", process.env.PAYNOC_WEBHOOK_SECRET)
      .update(\`\${ts}.\${raw}\`).digest("hex");
    const v1 = sig.split(",").find(p => p.startsWith("v1="))?.slice(3) ?? "";

    if (
      v1.length !== expected.length ||
      !timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
    ) return res.status(401).send("bad signature");

    // Reject events older than 5 minutes (replay protection)
    if (Math.abs(Date.now()/1000 - Number(ts)) > 300)
      return res.status(400).send("stale");

    const event = JSON.parse(raw);
    switch (event.event) {
      case "invoice.completed": /* fulfill order */ break;
      case "invoice.failed":    /* notify buyer  */ break;
      case "refund.processed":  /* update ledger */ break;
    }
    res.send("ok");
  }
);`;

const WEBHOOK_PHP = `<?php
$raw = file_get_contents("php://input");
$sig = $_SERVER["HTTP_X_PAYNOC_SIGNATURE"] ?? "";
$ts  = $_SERVER["HTTP_X_PAYNOC_TIMESTAMP"] ?? "";

$expected = hash_hmac("sha256", $ts . "." . $raw, getenv("PAYNOC_WEBHOOK_SECRET"));
$v1 = "";
foreach (explode(",", $sig) as $p) {
  if (str_starts_with($p, "v1=")) $v1 = substr($p, 3);
}
if (!hash_equals($expected, $v1)) { http_response_code(401); exit("bad signature"); }
if (abs(time() - (int)$ts) > 300)  { http_response_code(400); exit("stale"); }

$event = json_decode($raw, true);
// handle $event["event"] ...
echo "ok";`;

/* ---------------------- ui bits ---------------------- */

function Code({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-glass-border bg-card/60">
      {lang && (
        <div className="border-b border-glass-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Method({ verb, path }: { verb: "GET" | "POST" | "DELETE"; path: string }) {
  const color =
    verb === "GET"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : verb === "POST"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : "bg-rose-500/15 text-rose-400 border-rose-500/30";
  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${color}`}>{verb}</span>
      <span className="text-foreground">{path}</span>
    </div>
  );
}

function Field({
  name,
  type,
  required,
  desc,
}: {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}) {
  return (
    <div className="border-b border-glass-border/60 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-sm text-foreground">{name}</span>
        <span className="font-mono text-xs text-muted-foreground">{type}</span>
        {required && (
          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-400">
            required
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-glass-border pt-12">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>}
      <h2 className="mt-1 font-display text-2xl md:text-3xl">{title}</h2>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

const nav = [
  { group: "Getting started", items: [
    { id: "overview", label: "Overview" },
    { id: "quickstart", label: "Quickstart" },
    { id: "authentication", label: "Authentication" },
    { id: "environments", label: "Environments" },
  ]},
  { group: "Core concepts", items: [
    { id: "errors", label: "Errors" },
    { id: "idempotency", label: "Idempotency" },
    { id: "pagination", label: "Pagination" },
    { id: "rate-limits", label: "Rate limits" },
  ]},
  { group: "Invoices", items: [
    { id: "invoice-object", label: "The Invoice object" },
    { id: "create-invoice", label: "Create an invoice" },
    { id: "retrieve-invoice", label: "Retrieve an invoice" },
    { id: "list-invoices", label: "List invoices" },
    { id: "checkout", label: "Hosted checkout" },
  ]},
  { group: "Webhooks", items: [
    { id: "webhooks", label: "Overview" },
    { id: "webhook-verify", label: "Verify signature" },
    { id: "webhook-events", label: "Event types" },
    { id: "webhook-retries", label: "Retries" },
  ]},
  { group: "Advanced", items: [
    { id: "refunds", label: "Refunds" },
    { id: "testing", label: "Testing" },
    { id: "sdks", label: "SDKs & Postman" },
    { id: "plugins", label: "Plugins & integrations" },
  ]},
];

/* ---------------------- plugins ---------------------- */

type PublicPlugin = {
  id: string;
  name: string;
  slug: string;
  platform: string;
  description: string | null;
  version: string | null;
  icon_url: string | null;
  download_url: string | null;
  docs_url: string | null;
  repo_url: string | null;
};

function PluginsGrid() {
  const [rows, setRows] = useState<PublicPlugin[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("platform_plugins" as never) as any)
        .select("id,name,slug,platform,description,version,icon_url,download_url,docs_url,repo_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setRows((data ?? []) as PublicPlugin[]);
    })();
  }, []);

  if (rows === null) return <p className="text-sm text-muted-foreground">Loading plugins…</p>;
  if (rows.length === 0)
    return (
      <p className="rounded-lg border border-glass-border bg-card/40 p-4 text-sm text-muted-foreground">
        No plugins published yet. Check back soon — WordPress, WHMCS and Shopify integrations are on the way.
      </p>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((p) => (
        <div key={p.id} className="group rounded-2xl border border-glass-border bg-card/40 p-5 transition hover:-translate-y-0.5 hover:border-brand/40">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              {p.icon_url ? (
                <img src={p.icon_url} alt="" className="h-6 w-6" />
              ) : (
                <Package className="h-5 w-5" strokeWidth={2.25} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                  {p.platform}
                </span>
                {p.version && <span className="text-xs text-muted-foreground">v{p.version}</span>}
              </div>
              <h3 className="mt-1 font-display text-base font-semibold text-foreground">{p.name}</h3>
              {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {p.download_url && (
                  <a href={p.download_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-glass-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
                {p.docs_url && (
                  <a href={p.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-glass-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    <BookOpen className="h-3.5 w-3.5" /> Docs
                  </a>
                )}
                {p.repo_url && (
                  <a href={p.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-glass-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    <Github className="h-3.5 w-3.5" /> Source
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------- page ---------------------- */

function ApiReferencePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative">
        <SiteHeader />

        <div className="mx-auto max-w-7xl px-6 py-12 lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 text-sm">
              {nav.map((g) => (
                <div key={g.group} className="mb-6">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.group}
                  </p>
                  <ul className="space-y-1">
                    {g.items.map((i) => (
                      <li key={i.id}>
                        <a
                          href={`#${i.id}`}
                          className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {i.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="min-w-0">
            {/* Hero */}
            <header id="overview" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">REST · JSON</Badge>
                <Badge variant="secondary">v1</Badge>
                <Badge variant="secondary">Stable</Badge>
              </div>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">PayNOC API Reference</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                PayNOC is a REST API that runs over HTTPS, speaks JSON, and returns predictable errors.
                Authenticate with a secret key, create invoices, redirect customers to hosted checkout,
                and listen for HMAC-signed webhooks. Ship a working integration in an afternoon.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Card className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">Base URL</p>
                  <p className="mt-1 font-mono text-sm">{BASE}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">Auth header</p>
                  <p className="mt-1 font-mono text-sm">Authorization: Bearer sk_live_…</p>
                </Card>
              </div>
            </header>

            {/* Quickstart */}
            <Section id="quickstart" eyebrow="Getting started" title="Quickstart">
              <ol className="ml-5 list-decimal space-y-2 text-sm text-muted-foreground">
                <li>Create a merchant account and generate an API key from the dashboard.</li>
                <li>Set <span className="font-mono text-foreground">PAYNOC_SECRET_KEY</span> in your server env.</li>
                <li>POST to <span className="font-mono text-foreground">/invoices</span> and redirect the buyer to <span className="font-mono text-foreground">data.checkout_url</span>.</li>
                <li>Register a webhook URL and verify the HMAC signature on every event.</li>
              </ol>
              <Code lang="cURL" code={CURL_CREATE} />
            </Section>

            {/* Auth */}
            <Section id="authentication" eyebrow="Core" title="Authentication">
              <p className="text-sm text-muted-foreground">
                Every request must include an <span className="font-mono">Authorization</span> header with your
                secret key. Test keys are prefixed <span className="font-mono">sk_test_</span> and live keys with{" "}
                <span className="font-mono">sk_live_</span>. Never expose secret keys in browser code — treat them
                like passwords.
              </p>
              <Code lang="Header" code={`Authorization: Bearer sk_live_xxx`} />
              <p className="text-sm text-muted-foreground">
                Requests without a valid key return <span className="font-mono">401 Unauthorized</span>. If an IP
                whitelist is configured, requests from other IPs return <span className="font-mono">403 Forbidden</span>.
              </p>
            </Section>

            {/* Environments */}
            <Section id="environments" title="Environments">
              <div className="overflow-hidden rounded-lg border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Mode</th>
                      <th className="px-4 py-2">Key prefix</th>
                      <th className="px-4 py-2">Behaviour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    <tr><td className="px-4 py-2 font-mono">test</td><td className="px-4 py-2 font-mono">sk_test_</td><td className="px-4 py-2 text-muted-foreground">No real money moves. Gateway sandbox is used.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">live</td><td className="px-4 py-2 font-mono">sk_live_</td><td className="px-4 py-2 text-muted-foreground">Production. Real charges, real payouts.</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Errors */}
            <Section id="errors" title="Errors">
              <p className="text-sm text-muted-foreground">
                PayNOC uses conventional HTTP status codes. Every non-2xx response returns a JSON body with an{" "}
                <span className="font-mono">error</span> field describing what went wrong.
              </p>
              <Code lang="Error response" code={`{ "error": "amount is required and must be > 0" }`} />
              <div className="overflow-hidden rounded-lg border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Meaning</th><th className="px-4 py-2">Fix</th></tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    <tr><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Invalid JSON or missing field</td><td className="px-4 py-2 text-muted-foreground">Verify request body shape.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">401</td><td className="px-4 py-2">Missing / invalid API key</td><td className="px-4 py-2 text-muted-foreground">Send Authorization: Bearer sk_…</td></tr>
                    <tr><td className="px-4 py-2 font-mono">403</td><td className="px-4 py-2">IP not whitelisted</td><td className="px-4 py-2 text-muted-foreground">Add caller IP in the dashboard.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">404</td><td className="px-4 py-2">Resource not found</td><td className="px-4 py-2 text-muted-foreground">Check the ID.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">409</td><td className="px-4 py-2">Idempotency key reused with different body</td><td className="px-4 py-2 text-muted-foreground">Use a new key.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">429</td><td className="px-4 py-2">Rate limit exceeded</td><td className="px-4 py-2 text-muted-foreground">Back off; 120 req/min per key.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">500</td><td className="px-4 py-2">Internal error</td><td className="px-4 py-2 text-muted-foreground">Retry with exponential backoff.</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Idempotency */}
            <Section id="idempotency" title="Idempotency">
              <p className="text-sm text-muted-foreground">
                Safely retry <span className="font-mono">POST</span> requests by sending an{" "}
                <span className="font-mono">Idempotency-Key</span> header. The first response is stored for 24 hours
                and replayed on subsequent requests with the same key and identical body. Reusing a key with a
                different body returns <span className="font-mono">409 Conflict</span>.
              </p>
              <Code lang="Header" code={`Idempotency-Key: 8f14e45f-ceea-467a-9575-d0ab1af1b1e5`} />
              <p className="text-sm text-muted-foreground">
                Replayed responses include <span className="font-mono">Idempotent-Replay: true</span>.
              </p>
            </Section>

            {/* Pagination */}
            <Section id="pagination" title="Pagination">
              <p className="text-sm text-muted-foreground">
                List endpoints support a <span className="font-mono">limit</span> query parameter (default 25,
                max 100). Results are ordered by <span className="font-mono">created_at</span> descending.
              </p>
              <Code lang="cURL" code={`curl "${BASE}/invoices?limit=50" -H "Authorization: Bearer sk_live_xxx"`} />
            </Section>

            {/* Rate limits */}
            <Section id="rate-limits" title="Rate limits">
              <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
                <li>120 requests per minute per API key.</li>
                <li>Exceeding returns <span className="font-mono">429 Too Many Requests</span>.</li>
                <li>All requests are audit-logged with IP and user agent.</li>
              </ul>
            </Section>

            {/* Invoice object */}
            <Section id="invoice-object" eyebrow="Invoices" title="The Invoice object">
              <Code lang="Invoice" code={RESP_INVOICE} />
              <div className="rounded-lg border border-glass-border bg-card/40 p-4">
                <Field name="id" type="string" desc="Unique invoice identifier." />
                <Field name="invoice_number" type="string" desc="Human-readable number shown on checkout, e.g. INV-20260708-A1B2C3." />
                <Field name="amount" type="number" desc="Amount in major currency units (e.g. 1500 means 1,500 BDT). Must be greater than 0." />
                <Field name="currency" type="string" desc="ISO-4217 currency code. Defaults to BDT." />
                <Field name="status" type="enum" desc="pending · completed · failed · expired · refunded" />
                <Field name="mode" type="enum" desc="test or live — matches the key that created the invoice." />
                <Field name="checkout_url" type="url" desc="Hosted checkout URL — redirect the customer here." />
                <Field name="metadata" type="object" desc="Any JSON object you attach; returned verbatim in webhooks." />
                <Field name="expires_at" type="datetime" desc="ISO timestamp after which the invoice cannot be paid." />
                <Field name="paid_at" type="datetime" desc="ISO timestamp of successful payment (null until paid)." />
              </div>
            </Section>

            {/* Create */}
            <Section id="create-invoice" title="Create an invoice">
              <Method verb="POST" path="/v1/invoices" />
              <div className="rounded-lg border border-glass-border bg-card/40 p-4">
                <Field name="amount" type="number" required desc="Amount to charge in major currency units (e.g. 1500 = 1,500 BDT). Must be > 0." />
                <Field name="currency" type="string" desc="Currency code. Defaults to BDT." />
                <Field name="customer_name" type="string" desc="Buyer name shown on checkout and receipts." />
                <Field name="customer_email" type="string" desc="Buyer email — receives receipt." />
                <Field name="customer_phone" type="string" desc="Buyer phone — used by mobile-wallet gateways." />
                <Field name="description" type="string" desc="What the buyer is paying for." />
                <Field name="redirect_url" type="url" desc="Where to send the buyer after checkout." />
                <Field name="webhook_url" type="url" desc="Per-invoice webhook URL. Overrides the merchant default." />
                <Field name="expires_in_hours" type="integer" desc="Invoice lifetime in hours. Default 24." />
                <Field name="metadata" type="object" desc="Arbitrary JSON returned unchanged in every webhook." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Code lang="cURL" code={CURL_CREATE} />
                <Code lang="JavaScript" code={JS_CREATE} />
                <Code lang="PHP" code={PHP_CREATE} />
                <Code lang="Python" code={PY_CREATE} />
              </div>
              <Code lang="201 Created" code={RESP_INVOICE} />
            </Section>

            {/* Retrieve */}
            <Section id="retrieve-invoice" title="Retrieve an invoice">
              <Method verb="GET" path="/v1/invoices/{id}" />
              <Code lang="cURL" code={CURL_RETRIEVE} />
              <Code lang="200 OK" code={RESP_INVOICE} />
            </Section>

            {/* List */}
            <Section id="list-invoices" title="List invoices">
              <Method verb="GET" path="/v1/invoices" />
              <Code lang="cURL" code={CURL_LIST} />
              <Code lang="200 OK" code={`{
  "data": [
    { "id": "inv_…", "invoice_number": "INV-…", "amount": 1500, "status": "completed", "…": "…" },
    { "id": "inv_…", "invoice_number": "INV-…", "amount":  900, "status": "pending",   "…": "…" }
  ]
}`} />
            </Section>

            {/* Checkout */}
            <Section id="checkout" title="Hosted checkout">
              <p className="text-sm text-muted-foreground">
                Every invoice has a <span className="font-mono">checkout_url</span>. Redirect the buyer there and
                PayNOC handles gateway selection (bKash, Nagad, Rocket, Uddoktapay, OWNpay, Piprapay, card),
                verification, receipts, and the return-to-merchant redirect.
              </p>
              <Code lang="Redirect" code={`res.redirect(302, invoice.checkout_url);`} />
              <p className="text-sm text-muted-foreground">
                After payment the buyer is sent to your <span className="font-mono">redirect_url</span> with{" "}
                <span className="font-mono">?invoice_id=…&status=completed</span>. Never trust the redirect alone —
                confirm state via the webhook or a follow-up{" "}
                <span className="font-mono">GET /invoices/{"{"}id{"}"}</span>.
              </p>
            </Section>

            {/* Webhooks */}
            <Section id="webhooks" eyebrow="Webhooks" title="Webhooks">
              <p className="text-sm text-muted-foreground">
                PayNOC POSTs a JSON payload to your webhook URL for every lifecycle event. Each request is signed
                with HMAC-SHA256 so you can verify it originated from PayNOC and was not tampered with.
              </p>
              <Code lang="Sample event" code={WEBHOOK_PAYLOAD} />
              <div className="rounded-lg border border-glass-border bg-card/40 p-4 text-sm">
                <p className="font-semibold">Headers sent with every webhook</p>
                <ul className="mt-2 ml-5 list-disc space-y-1 text-muted-foreground">
                  <li><span className="font-mono text-foreground">x-paynoc-signature</span> — <span className="font-mono">t=&lt;ts&gt;,v1=&lt;hex_hmac&gt;</span></li>
                  <li><span className="font-mono text-foreground">x-paynoc-timestamp</span> — unix seconds</li>
                  <li><span className="font-mono text-foreground">x-paynoc-event</span> — event type</li>
                  <li><span className="font-mono text-foreground">x-paynoc-delivery</span> — unique delivery ID</li>
                </ul>
              </div>
            </Section>

            <Section id="webhook-verify" title="Verify the signature">
              <p className="text-sm text-muted-foreground">
                Compute HMAC-SHA256 over{" "}
                <span className="font-mono">&lt;timestamp&gt;.&lt;raw_body&gt;</span> using your webhook secret,
                and compare it to the <span className="font-mono">v1=</span> part of the signature header with a
                timing-safe compare. Reject events older than 5 minutes to prevent replay attacks.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Code lang="Node.js / Express" code={WEBHOOK_NODE} />
                <Code lang="PHP" code={WEBHOOK_PHP} />
              </div>
            </Section>

            <Section id="webhook-events" title="Event types">
              <div className="overflow-hidden rounded-lg border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">When it fires</th></tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    <tr><td className="px-4 py-2 font-mono">invoice.created</td><td className="px-4 py-2 text-muted-foreground">A new invoice was created via API.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">invoice.completed</td><td className="px-4 py-2 text-muted-foreground">Payment verified by the underlying gateway.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">invoice.failed</td><td className="px-4 py-2 text-muted-foreground">Buyer cancelled or gateway rejected the payment.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">invoice.expired</td><td className="px-4 py-2 text-muted-foreground">Invoice passed its <span className="font-mono">expires_at</span> unpaid.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">refund.requested</td><td className="px-4 py-2 text-muted-foreground">Merchant (dashboard or API) opened a refund request.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">refund.approved</td><td className="px-4 py-2 text-muted-foreground">Admin approved the refund for processing.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">refund.rejected</td><td className="px-4 py-2 text-muted-foreground">Admin rejected the refund request.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">refund.processed</td><td className="px-4 py-2 text-muted-foreground">Refund completed at the gateway; funds returned to buyer.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">invoice.refunded</td><td className="px-4 py-2 text-muted-foreground">Invoice has been fully refunded.</td></tr>
                    <tr><td className="px-4 py-2 font-mono">payout.processed</td><td className="px-4 py-2 text-muted-foreground">Merchant payout has been sent.</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="webhook-retries" title="Retries">
              <p className="text-sm text-muted-foreground">
                Return HTTP <span className="font-mono">2xx</span> within 10 seconds to acknowledge delivery. Any
                other response — or a timeout — is retried with exponential backoff for up to 24 hours:
                <span className="font-mono"> 30s, 2m, 10m, 30m, 1h, 2h, 6h, 12h</span>. Handle events idempotently
                using the event <span className="font-mono">id</span>.
              </p>
            </Section>

            {/* Refunds & payouts */}
            <Section id="refunds" eyebrow="Advanced" title="Refunds">
              <p className="text-sm text-muted-foreground">
                Request a full or partial refund on a <span className="font-mono">completed</span> invoice.
                Refunds start in <span className="font-mono">requested</span> state and move through{" "}
                <span className="font-mono">approved</span> → <span className="font-mono">processed</span> once
                reviewed. Every state change fires a webhook.
              </p>
              <Method verb="POST" path="/v1/refunds" />
              <div className="rounded-lg border border-glass-border bg-card/40 p-4">
                <Field name="invoice_id" type="string" required desc="ID of the completed invoice to refund." />
                <Field name="amount" type="number" desc="Amount to refund. Omit to refund the full invoice. Partial refunds are supported; total refunded across all requests can't exceed the invoice amount." />
                <Field name="reason" type="string" desc="Short human-readable reason (surfaced in the admin dashboard)." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Code lang="cURL" code={`curl -X POST ${BASE}/refunds \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "invoice_id": "inv_7f2b4c8a...",
    "amount": 500,
    "reason": "Customer request"
  }'`} />
                <Code lang="JavaScript" code={`await fetch("${BASE}/refunds", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.PAYNOC_SECRET_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    invoice_id: "inv_7f2b4c8a...",
    amount: 500,           // omit for full refund
    reason: "Customer request",
  }),
});`} />
              </div>
              <Code lang="201 Created" code={`{
  "data": {
    "id": "rf_1a2b3c4d...",
    "invoice_id": "inv_7f2b4c8a...",
    "amount": 500,
    "currency": "BDT",
    "status": "requested",
    "reason": "Customer request",
    "created_at": "2026-07-09T09:11:00.000Z"
  }
}`} />
              <Method verb="GET" path="/v1/refunds" />
              <p className="text-sm text-muted-foreground">
                List refunds for the authenticated merchant. Optional{" "}
                <span className="font-mono">?invoice_id=</span> filter, <span className="font-mono">?limit=</span>{" "}
                up to 100. Refunds are strictly scoped to the merchant that owns the API key — a key can never
                touch or refund another merchant's invoice.
              </p>
              <Code lang="cURL" code={`curl "${BASE}/refunds?invoice_id=inv_7f2b4c8a..." \\
  -H "Authorization: Bearer sk_live_xxx"`} />
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
                <p className="font-semibold text-warning">Security note</p>
                <p className="mt-1 text-muted-foreground">
                  API keys can only <em>request</em> refunds — they never mark an invoice paid, complete a
                  transaction, or bypass gateway verification. Payment state changes only when the underlying
                  gateway (bKash, Nagad, Rocket, SSLCOMMERZ, Uddoktapay, OWNpay, Piprapay, card, BYO…) confirms
                  the money moved, or a platform admin manually verifies a transaction from the dashboard.
                  Approving and processing a refund still requires a signed-in admin.
                </p>
              </div>
            </Section>

            {/* Testing */}
            <Section id="testing" title="Testing">
              <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
                <li>Use a <span className="font-mono">sk_test_</span> key — every invoice is created in test mode.</li>
                <li>Gateway sandboxes accept any well-formed OTP for a completed payment.</li>
                <li>Trigger a test webhook from the dashboard to any URL, including <span className="font-mono">https://webhook.site</span>.</li>
                <li>Use an <span className="font-mono">Idempotency-Key</span> to safely re-run scripts.</li>
              </ul>
            </Section>

            {/* SDKs / Postman */}
            <Section id="sdks" title="SDKs & Postman">
              <p className="text-sm text-muted-foreground">
                Official SDKs (Node.js, PHP, Python) are coming soon. In the meantime, any HTTP client works —
                the API is standard REST + JSON.
              </p>
              <a
                href="/api/public/v1/postman"
                className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/40 px-4 py-2 text-sm font-medium hover:bg-muted"
                download
              >
                ⬇ Download Postman collection
              </a>
            </Section>

            {/* Plugins */}
            <Section id="plugins" eyebrow="Integrations" title="Plugins & platform integrations">
              <p className="text-sm text-muted-foreground">
                Drop-in modules for the platforms you already run. Every listing here is published live by the
                PayNOC team — download the archive, install it in your platform, paste your API key, and you're
                accepting payments in minutes.
              </p>
              <PluginsGrid />
            </Section>


            <div className="mt-16 rounded-lg border border-glass-border bg-card/40 p-6 text-sm text-muted-foreground">
              Need help? Email <a href="mailto:developers@paynoc.bd" className="font-mono text-foreground underline">developers@paynoc.bd</a> or
              open a support ticket from your merchant dashboard — we typically reply within one business day.
            </div>
          </main>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
