import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Method } from "./types";

/** Signed-URL QR loader for merchant-uploaded QR images */
export function PayQr({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("payment-assets")
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className="h-48 w-48 animate-pulse rounded-xl bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Scan to pay" className="h-48 w-48 rounded-xl border border-glass-border bg-white object-contain p-2" />
    </a>
  );
}

/** Local QR generator with in-memory cache per input */
const QR_CACHE = new Map<string, string>();
export function LocalQr({ text }: { text: string }) {
  const [url, setUrl] = useState<string | null>(() => QR_CACHE.get(text) ?? null);
  useEffect(() => {
    let alive = true;
    const cached = QR_CACHE.get(text);
    if (cached) { setUrl(cached); return; }
    import("qrcode")
      .then(({ default: QR }) =>
        QR.toDataURL(text, { width: 300, margin: 2, errorCorrectionLevel: "M" }),
      )
      .then((d) => { QR_CACHE.set(text, d); if (alive) setUrl(d); })
      .catch(() => { /* noop */ });
    return () => { alive = false; };
  }, [text]);
  if (!url) return <div className="h-48 w-48 animate-pulse rounded-xl bg-muted" />;
  return (
    <img
      src={url}
      alt="Scan to pay"
      className="h-48 w-48 rounded-xl border border-glass-border bg-white object-contain p-2"
    />
  );
}

export function qrFallbackEligible(m: Method): boolean {
  if (m.qr_code_url) return false;
  if (!m.account_number) return false;
  return ["bkash", "nagad", "rocket", "upay", "tap", "mcash", "sure_cash"].includes(m.type);
}
