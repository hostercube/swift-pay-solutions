import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MerchantTracking, type TrackingConfig } from "@/components/merchant-tracking";

export const Route = createFileRoute("/m/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Pay ${params.slug} · PayNOC` },
      { name: "description", content: `Send a tip or payment to ${params.slug} securely via PayNOC.` },
    ],
  }),
  component: PublicMerchantPage,
});

type Merchant = {
  id: string;
  business_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  public_bio: string | null;
  accept_tips: boolean;
  tip_min_amount: number;
  support_email: string | null;
  slug: string;
  seo_meta_description?: string | null;
  seo_meta_keywords?: string | null;
  ga4_measurement_id?: string | null;
  gtm_container_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  custom_head_html?: string | null;
  custom_footer_html?: string | null;
};

function PublicMerchantPage() {
  const { slug } = Route.useParams();
  const [m, setM] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown }>;
      const { data } = await rpc("get_public_merchant", { _slug: slug });
      const row = Array.isArray(data) ? data[0] : null;
      setM((row as Merchant) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  const pay = async () => {
    if (!m) return;
    const amt = Number(amount);
    if (!amt || amt < Number(m.tip_min_amount))
      return toast.error(`Minimum tip is ৳ ${m.tip_min_amount}`);
    if (!email.trim()) return toast.error("Email required");
    setBusy(true);
    const invNumber = `TIP-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await (supabase.from as unknown as (t: string) => {
      insert: (r: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    })("invoices")
      .insert({
        merchant_id: m.id,
        invoice_number: invNumber,
        amount: amt,
        currency: "BDT",
        customer_name: name.trim() || null,
        customer_email: email.trim(),
        description: note.trim() || "Tip / donation",
        status: "pending",
        mode: "live",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.location.href = `/pay/${data.id}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Merchant not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link is invalid or the merchant has removed their public page.
          </p>
        </div>
      </div>
    );
  }

  const style = m.brand_color
    ? ({ ["--brand" as never]: m.brand_color } as React.CSSProperties)
    : undefined;

  return (
    <div className="relative min-h-screen bg-background" style={style}>
      <MerchantTracking config={m as TrackingConfig} />
      <MerchantSeoHead merchant={m} />
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-lg px-4 py-16">
        <div className="glass rounded-3xl border border-glass-border p-8 text-center">
          {m.logo_url ? (
            <img
              src={m.logo_url}
              alt={m.business_name ?? "Merchant"}
              className="mx-auto h-20 w-20 rounded-2xl object-contain"
            />
          ) : (
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-brand">
              <Shield className="h-10 w-10 text-brand-foreground" />
            </span>
          )}
          <h1 className="mt-4 font-display text-2xl font-bold">
            {m.business_name ?? m.slug}
          </h1>
          {m.public_bio && (
            <p className="mt-2 text-sm text-muted-foreground">{m.public_bio}</p>
          )}
        </div>

        {m.accept_tips ? (
          <div className="glass mt-6 rounded-3xl border border-glass-border p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-brand" />
              Send a tip
            </div>
            <div className="grid gap-2">
              <Input
                type="number"
                placeholder={`Amount (min ৳ ${m.tip_min_amount})`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex gap-2">
                {[100, 500, 1000, 2000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="flex-1 rounded-lg border border-glass-border py-2 text-xs hover:border-brand"
                  >
                    ৳ {v}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Message (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                className="mt-2 w-full bg-gradient-brand text-brand-foreground"
                onClick={pay}
                disabled={busy}
              >
                {busy ? "Creating…" : "Continue to secure checkout"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            This merchant is not accepting public tips right now.
          </p>
        )}

        <div className="mt-6 text-center text-[11px] text-muted-foreground">
          {m.support_email && (
            <div>
              Contact:{" "}
              <a href={`mailto:${m.support_email}`} className="underline">
                {m.support_email}
              </a>
            </div>
          )}
          <div>Secured by PayNOC</div>
        </div>
      </div>
    </div>
  );
}

function MerchantSeoHead({ merchant }: { merchant: Merchant }) {
  useEffect(() => {
    const title = merchant.business_name
      ? `${merchant.business_name} · PayNOC`
      : `Pay ${merchant.slug} · PayNOC`;
    document.title = title;
    const desc =
      merchant.seo_meta_description?.trim() ||
      merchant.public_bio?.trim() ||
      `Send a payment to ${merchant.business_name ?? merchant.slug} securely via PayNOC.`;
    setMeta("name", "description", desc);
    if (merchant.seo_meta_keywords?.trim()) {
      setMeta("name", "keywords", merchant.seo_meta_keywords.trim());
    }
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    if (merchant.logo_url) setMeta("property", "og:image", merchant.logo_url);
  }, [merchant]);
  return null;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
