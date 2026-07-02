import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Code2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrate")({
  head: () => ({ meta: [{ title: "Integrate · PayNOC" }] }),
  component: IntegratePage,
});

function Snippet({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-auto rounded-xl border border-glass-border bg-black/40 p-4 text-xs text-foreground/90">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          toast.success("Copied");
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-glass-border bg-black/40 px-2 py-1 text-xs hover:border-brand"
      >
        <Copy className="h-3 w-3" /> Copy
      </button>
    </div>
  );
}

function IntegratePage() {
  const [invoiceId, setInvoiceId] = useState("YOUR_INVOICE_ID");
  const host =
    typeof window !== "undefined" && window.location.hostname.includes("paynoc.bd")
      ? "https://pay.paynoc.bd"
      : typeof window !== "undefined"
        ? window.location.origin
        : "https://pay.paynoc.bd";

  const redirect = `${host}/pay/${invoiceId}`;
  const iframeHtml = `<iframe
  src="${redirect}"
  style="border:0;width:100%;height:760px;border-radius:16px"
  allow="payment *"></iframe>`;
  const buttonSnippet = `<script src="${host}/embed.js"
  data-invoice="${invoiceId}"
  data-label="Pay ৳"
  data-auto-redirect="1"></script>`;
  const inlineSnippet = `<div data-paynoc-inline data-invoice="${invoiceId}"
  style="height:760px;max-width:480px;margin:auto"></div>
<script src="${host}/embed.js"></script>`;
  const jsApi = `<script src="${host}/embed.js"></script>
<button onclick="PayNOC.open({
  invoice: '${invoiceId}',
  autoRedirect: true,
  onSuccess: (d) => { console.log('paid', d); },
  onEvent:   (d) => { console.log('event', d); }
})">Pay now</button>`;
  const apiCreate = `curl -X POST ${host.replace("pay.", "api.")}/api/public/v1/invoices \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 500,
    "currency": "BDT",
    "customer_email": "buyer@example.com",
    "redirect_url": "https://yoursite.com/thank-you"
  }'`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrate PayNOC</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Redirect link, iframe embed, or one-click JS button — apnar website a ja mon chay basun.
        </p>
      </div>

      <div className="glass rounded-2xl border border-glass-border p-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Test invoice ID
        </label>
        <input
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          placeholder="YOUR_INVOICE_ID"
          className="mt-2 w-full rounded-lg border border-glass-border bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-brand"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Invoices → create korle je ID paben ta use korun (or REST API diye create korun below).
        </p>
      </div>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-brand" />
          <h2 className="font-display text-lg font-bold">1. Redirect link (simplest)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customer ke amader hosted checkout page a pathiye din. Payment shesh hole
          apnar <code>redirect_url</code> a auto-forward hobe.
        </p>
        <Snippet code={redirect} />
      </section>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-brand" />
          <h2 className="font-display text-lg font-bold">2. Iframe embed (inline on your page)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Apnar page cheke chere na diye checkout dekhan. Status change hole parent window a
          <code> postMessage</code> pathay (`type: "paynoc:status"`).
        </p>
        <Snippet code={iframeHtml} />
      </section>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <h2 className="font-display text-lg font-bold">3. One-line JS button (modal popup)</h2>
        <p className="text-sm text-muted-foreground">
          Script tag boste ekta "Pay now" button dekhabe; click korle modal a checkout khulbe.
        </p>
        <Snippet code={buttonSnippet} />
      </section>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <h2 className="font-display text-lg font-bold">4. Inline placeholder (custom size)</h2>
        <Snippet code={inlineSnippet} />
      </section>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <h2 className="font-display text-lg font-bold">5. Programmatic API (callbacks)</h2>
        <Snippet code={jsApi} />
      </section>

      <section className="glass space-y-3 rounded-2xl border border-glass-border p-5">
        <h2 className="font-display text-lg font-bold">6. Create invoice via REST (server side)</h2>
        <Snippet code={apiCreate} />
      </section>

      <div className="glass rounded-2xl border border-glass-border p-5 text-sm text-muted-foreground">
        <b className="text-foreground">Security:</b> Iframe embed check korte hole apnar site a
        <code> window.addEventListener("message", …)</code> use korun and
        <code> event.data.source === "paynoc"</code> verify korun. Server side a always webhook
        signature verify korun — sudhu client message er upor bharsha korben na.
      </div>
    </div>
  );
}
