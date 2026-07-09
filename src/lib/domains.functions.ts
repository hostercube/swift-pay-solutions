import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verify a merchant custom domain by looking up its `_paynoc-verify.<domain>`
 * TXT record via Cloudflare DNS-over-HTTPS. If the record contains the
 * expected verify_token, mark the domain verified.
 */
export const verifyMerchantDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domain_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("merchant_domains" as never)
      .select("id, domain, verify_token, verified_at")
      .eq("id", data.domain_id)
      .maybeSingle();

    if (error || !row) {
      return { ok: false, message: "Domain not found" };
    }
    const record = row as unknown as {
      id: string;
      domain: string;
      verify_token: string;
      verified_at: string | null;
    };

    const name = `_paynoc-verify.${record.domain}`;
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
        { headers: { accept: "application/dns-json" } },
      );
      if (!res.ok) return { ok: false, message: "DNS lookup failed" };
      const dns = (await res.json()) as { Answer?: Array<{ data: string }> };
      const values = (dns.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
      const expected = `paynoc-verify=${record.verify_token}`;
      const match = values.some((v) => v.includes(expected));
      if (!match) {
        return {
          ok: false,
          message: `TXT record not found. Add TXT ${name} = ${expected} at your DNS provider, then retry (propagation can take a few minutes).`,
        };
      }
    } catch {
      return { ok: false, message: "DNS lookup failed" };
    }

    const { error: rpcErr } = await supabase.rpc("mark_domain_verified" as never, {
      _domain_id: record.id,
    } as never);
    if (rpcErr) return { ok: false, message: rpcErr.message };
    return { ok: true, message: "Domain verified" };
  });
