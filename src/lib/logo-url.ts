import { supabase } from "@/integrations/supabase/client";
import { defaultLogoFor } from "@/lib/gateways/registry";

/**
 * Resolve a displayable logo URL.
 *
 * `stored` may be:
 *   - a full http(s) URL (returned as-is),
 *   - a storage path inside the public `payment-assets/logos/…` folder,
 *   - null / empty → fall back to the default gateway logo for `fallbackId`.
 */
export function resolveLogoUrl(stored: string | null | undefined, fallbackId?: string): string | undefined {
  const s = stored?.trim();
  if (s) {
    if (/^https?:\/\//i.test(s)) return s;
    const { data } = supabase.storage.from("payment-assets").getPublicUrl(s);
    return data.publicUrl;
  }
  return fallbackId ? defaultLogoFor(fallbackId) : undefined;
}
