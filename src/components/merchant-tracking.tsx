import { useEffect } from "react";

export type TrackingConfig = {
  ga4_measurement_id?: string | null;
  gtm_container_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  custom_head_html?: string | null;
  custom_footer_html?: string | null;
};

const LOADED = new Set<string>();

function inject(id: string, build: () => HTMLElement | HTMLElement[]) {
  if (LOADED.has(id)) return;
  LOADED.add(id);
  const els = build();
  (Array.isArray(els) ? els : [els]).forEach((el) => {
    el.setAttribute("data-merchant-tracking", id);
    document.head.appendChild(el);
  });
}

function injectRawHtml(id: string, html: string, where: "head" | "body") {
  if (LOADED.has(id)) return;
  LOADED.add(id);
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const target = where === "head" ? document.head : document.body;
  Array.from(tpl.content.childNodes).forEach((n) => {
    // Re-create scripts so they execute
    if (n.nodeType === 1 && (n as Element).tagName === "SCRIPT") {
      const src = (n as HTMLScriptElement).src;
      const s = document.createElement("script");
      Array.from((n as Element).attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = (n as HTMLScriptElement).text;
      s.setAttribute("data-merchant-tracking", id);
      if (src) s.src = src;
      target.appendChild(s);
    } else {
      if (n.nodeType === 1) (n as Element).setAttribute("data-merchant-tracking", id);
      target.appendChild(n.cloneNode(true));
    }
  });
}

export function MerchantTracking({ config }: { config: TrackingConfig | null | undefined }) {
  useEffect(() => {
    if (!config) return;
    const w = window as unknown as Record<string, unknown>;

    // Google Tag Manager
    if (config.gtm_container_id) {
      const id = `gtm-${config.gtm_container_id}`;
      inject(id, () => {
        const s = document.createElement("script");
        s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtm_container_id}');`;
        return s;
      });
    }

    // GA4
    if (config.ga4_measurement_id) {
      const id = `ga4-${config.ga4_measurement_id}`;
      inject(id, () => {
        const loader = document.createElement("script");
        loader.async = true;
        loader.src = `https://www.googletagmanager.com/gtag/js?id=${config.ga4_measurement_id}`;
        const inline = document.createElement("script");
        inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${config.ga4_measurement_id}');`;
        return [loader, inline];
      });
    }

    // Meta / Facebook Pixel
    if (config.meta_pixel_id) {
      const id = `fbq-${config.meta_pixel_id}`;
      inject(id, () => {
        const s = document.createElement("script");
        s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.meta_pixel_id}');fbq('track','PageView');`;
        return s;
      });
    }

    // TikTok Pixel
    if (config.tiktok_pixel_id) {
      const id = `ttq-${config.tiktok_pixel_id}`;
      inject(id, () => {
        const s = document.createElement("script");
        s.text = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${config.tiktok_pixel_id}');ttq.page();}(window,document,'ttq');`;
        return s;
      });
    }

    // Google Ads (gtag) — reuse GA4's loader if present
    if (config.google_ads_conversion_id) {
      const id = `gads-${config.google_ads_conversion_id}`;
      inject(id, () => {
        const els: HTMLElement[] = [];
        if (!config.ga4_measurement_id) {
          const loader = document.createElement("script");
          loader.async = true;
          loader.src = `https://www.googletagmanager.com/gtag/js?id=${config.google_ads_conversion_id}`;
          els.push(loader);
        }
        const inline = document.createElement("script");
        inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${config.google_ads_conversion_id}');`;
        els.push(inline);
        return els;
      });
    }

    // Custom head HTML (verification tags, chat, etc.)
    if (config.custom_head_html?.trim()) {
      injectRawHtml("custom-head", config.custom_head_html, "head");
    }
    if (config.custom_footer_html?.trim()) {
      injectRawHtml("custom-footer", config.custom_footer_html, "body");
    }

    void w;
  }, [config]);

  return null;
}

type FbqFn = (...args: unknown[]) => void;
type GtagFn = (...args: unknown[]) => void;
type TtqInstance = { track: (...args: unknown[]) => void };
type TtqFn = { instance: (id: string) => TtqInstance };

export function trackPurchase(
  config: TrackingConfig | null | undefined,
  data: { value: number; currency: string; transactionId: string },
) {
  if (!config) return;
  const w = window as unknown as {
    fbq?: FbqFn;
    gtag?: GtagFn;
    ttq?: TtqFn;
    dataLayer?: unknown[];
  };
  if (config.meta_pixel_id && w.fbq) {
    w.fbq("track", "Purchase", { value: data.value, currency: data.currency });
  }
  if (config.ga4_measurement_id && w.gtag) {
    w.gtag("event", "purchase", {
      transaction_id: data.transactionId,
      value: data.value,
      currency: data.currency,
    });
  }
  if (
    config.google_ads_conversion_id &&
    config.google_ads_conversion_label &&
    w.gtag
  ) {
    w.gtag("event", "conversion", {
      send_to: `${config.google_ads_conversion_id}/${config.google_ads_conversion_label}`,
      value: data.value,
      currency: data.currency,
      transaction_id: data.transactionId,
    });
  }
  if (config.tiktok_pixel_id && w.ttq) {
    try {
      w.ttq.instance(config.tiktok_pixel_id).track("CompletePayment", {
        value: data.value,
        currency: data.currency,
        content_id: data.transactionId,
      });
    } catch {
      /* noop */
    }
  }
  if (config.gtm_container_id && w.dataLayer) {
    w.dataLayer.push({
      event: "purchase",
      transaction_id: data.transactionId,
      value: data.value,
      currency: data.currency,
    });
  }
}
