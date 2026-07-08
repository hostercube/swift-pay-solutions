import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [{ title: "Marketing & SEO · PayNOC" }] }),
  component: MarketingPage,
});

type Cfg = {
  ga4_measurement_id: string | null;
  gtm_container_id: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  meta_capi_test_code: string | null;
  tiktok_pixel_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  custom_head_html: string | null;
  custom_footer_html: string | null;
  seo_meta_description: string | null;
  seo_meta_keywords: string | null;
};

const FIELDS: Array<keyof Cfg> = [
  "ga4_measurement_id",
  "gtm_container_id",
  "meta_pixel_id",
  "meta_capi_token",
  "meta_capi_test_code",
  "tiktok_pixel_id",
  "google_ads_conversion_id",
  "google_ads_conversion_label",
  "custom_head_html",
  "custom_footer_html",
  "seo_meta_description",
  "seo_meta_keywords",
];

const EMPTY: Cfg = {
  ga4_measurement_id: "",
  gtm_container_id: "",
  meta_pixel_id: "",
  meta_capi_token: "",
  meta_capi_test_code: "",
  tiktok_pixel_id: "",
  google_ads_conversion_id: "",
  google_ads_conversion_label: "",
  custom_head_html: "",
  custom_footer_html: "",
  seo_meta_description: "",
  seo_meta_keywords: "",
};

function MarketingPage() {
  const { user } = useAuth();
  const [c, setC] = useState<Cfg>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(FIELDS.join(","))
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const row = data as unknown as Partial<Cfg>;
        setC({
          ...EMPTY,
          ...Object.fromEntries(FIELDS.map((f) => [f, row[f] ?? ""])),
        } as Cfg);
      });
  }, [user]);

  const set = <K extends keyof Cfg>(k: K, v: string) => setC((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const patch = Object.fromEntries(
      FIELDS.map((f) => [f, (c[f] ?? "").toString().trim() || null]),
    ) as Record<string, string | null>;
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marketing & SEO settings saved");
  };

  return (
    <MerchantShell
      title="Marketing & SEO"
      subtitle="Add your tracking pixels, SEO metadata, and custom head/footer HTML. These fire on your public checkout and storefront pages."
    >
      <div className="space-y-8">
        <Section title="Google" subtitle="GA4 measurement, GTM container, and Google Ads conversion.">
          <Row label="GA4 Measurement ID" hint="e.g. G-XXXXXXX">
            <Input value={c.ga4_measurement_id ?? ""} onChange={(e) => set("ga4_measurement_id", e.target.value)} placeholder="G-XXXXXXX" />
          </Row>
          <Row label="Google Tag Manager Container ID" hint="e.g. GTM-XXXXXXX">
            <Input value={c.gtm_container_id ?? ""} onChange={(e) => set("gtm_container_id", e.target.value)} placeholder="GTM-XXXXXXX" />
          </Row>
          <Row label="Google Ads Conversion ID" hint="e.g. AW-1234567890">
            <Input value={c.google_ads_conversion_id ?? ""} onChange={(e) => set("google_ads_conversion_id", e.target.value)} placeholder="AW-1234567890" />
          </Row>
          <Row label="Google Ads Conversion Label" hint="The label for the Purchase conversion action">
            <Input value={c.google_ads_conversion_label ?? ""} onChange={(e) => set("google_ads_conversion_label", e.target.value)} placeholder="abcDEF123" />
          </Row>
        </Section>

        <Section title="Meta (Facebook / Instagram)" subtitle="Pixel + Conversion API for purchase tracking.">
          <Row label="Meta Pixel ID">
            <Input value={c.meta_pixel_id ?? ""} onChange={(e) => set("meta_pixel_id", e.target.value)} placeholder="123456789012345" />
          </Row>
          <Row label="Conversion API Access Token" hint="Server-side. Never shown on the public page.">
            <Input type="password" value={c.meta_capi_token ?? ""} onChange={(e) => set("meta_capi_token", e.target.value)} placeholder="EAAG..." />
          </Row>
          <Row label="CAPI Test Event Code" hint="Optional. From Events Manager → Test events.">
            <Input value={c.meta_capi_test_code ?? ""} onChange={(e) => set("meta_capi_test_code", e.target.value)} placeholder="TEST12345" />
          </Row>
        </Section>

        <Section title="TikTok">
          <Row label="TikTok Pixel ID">
            <Input value={c.tiktok_pixel_id ?? ""} onChange={(e) => set("tiktok_pixel_id", e.target.value)} placeholder="CXXXXXXXXXXXXXXX" />
          </Row>
        </Section>

        <Section title="SEO metadata" subtitle="Applied to your public storefront (/m/your-slug).">
          <Row label="Meta description" hint="≤ 160 characters is best">
            <Textarea rows={2} value={c.seo_meta_description ?? ""} onChange={(e) => set("seo_meta_description", e.target.value)} />
          </Row>
          <Row label="Meta keywords" hint="Comma-separated. Optional; most search engines ignore this now.">
            <Input value={c.seo_meta_keywords ?? ""} onChange={(e) => set("seo_meta_keywords", e.target.value)} />
          </Row>
        </Section>

        <Section
          title="Custom HTML"
          subtitle="Injected into every public checkout / storefront page. Use for site verification tags, chat widgets, custom analytics."
        >
          <Row label="Custom <head> HTML">
            <Textarea rows={5} className="font-mono text-xs" value={c.custom_head_html ?? ""} onChange={(e) => set("custom_head_html", e.target.value)} placeholder='<meta name="google-site-verification" content="..." />' />
          </Row>
          <Row label="Custom footer HTML (end of <body>)">
            <Textarea rows={5} className="font-mono text-xs" value={c.custom_footer_html ?? ""} onChange={(e) => set("custom_footer_html", e.target.value)} placeholder="<!-- Live chat widget -->" />
          </Row>
          <p className="text-[11px] text-amber-500/90">
            Custom HTML runs on your public pages with your visitors' browsers. Only paste snippets from
            providers you trust.
          </p>
        </Section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-gradient-brand text-brand-foreground">
            {saving ? "Saving…" : "Save all"}
          </Button>
        </div>
      </div>
    </MerchantShell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border border-glass-border p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
