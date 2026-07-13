import { createFileRoute } from "@tanstack/react-router";

/**
 * Background drainer for pending transactions.
 *
 * Two passes, both idempotent:
 *  1) Retry unmatched SMS events (`sms_event_logs.outcome IN
 *     ('no_match','error')`) from the last 24h — a customer may have entered
 *     the TrxID *after* the SMS arrived, so re-running L1/L2 now catches it.
 *  2) Drain stale pending transactions past their invoice expiry (or older
 *     than 24h if no expiry) — marks the txn `rejected` with
 *     `drained_at=now()`. Invoice auto-expire is handled by expire-invoices.
 */
const RETRY_WINDOW_MIN = 60 * 24;   // look back 24h for unmatched SMS
const STALE_TXN_HOURS = 24;         // pending txns older than this get drained

export const Route = createFileRoute("/api/public/hooks/drain-pending")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
        const { matchAndVerify } = await import("@/lib/sms-match.server");

        // ---- Pass 1: replay unmatched SMS from recent window
        const since = new Date(Date.now() - RETRY_WINDOW_MIN * 60_000).toISOString();
        const { data: retryable, error: rErr } = await supabaseAdmin
          .from("sms_event_logs")
          .select("id, merchant_id, provider, trx_id, sender, amount, raw_body, device_id, received_at")
          .in("outcome", ["no_match", "error"])
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(200);
        if (rErr) console.error("[drain] fetch sms logs", rErr.message);

        let replayed = 0, verified = 0;
        for (const row of retryable ?? []) {
          replayed++;
          const r = await matchAndVerify(
            supabaseAdmin,
            row.merchant_id,
            {
              provider: row.provider ?? "",
              raw_body: row.raw_body ?? "",
              trx_id: row.trx_id ?? undefined,
              amount: row.amount ?? undefined,
              sender: row.sender ?? undefined,
              received_at: row.received_at ?? undefined,
              device_id: row.device_id ?? undefined,
            },
            { source: "drain_cron" },
          );
          if (r.outcome === "verified") verified++;
        }

        // ---- Pass 2: drain stale pending transactions
        const staleCutoff = new Date(Date.now() - STALE_TXN_HOURS * 3600_000).toISOString();
        const { data: stale, error: sErr } = await supabaseAdmin
          .from("transactions")
          .select("id, merchant_id, invoice_id, created_at, invoices!inner(id, status, expires_at)")
          .eq("status", "pending")
          .lt("created_at", staleCutoff)
          .limit(200);
        if (sErr) console.error("[drain] fetch stale", sErr.message);

        const nowIso = new Date().toISOString();
        let drained = 0;
        for (const t of stale ?? []) {
          const inv = (t as unknown as { invoices?: { status?: string; expires_at?: string | null } }).invoices;
          const invExpired = inv?.status && inv.status !== "pending"
            ? true
            : (inv?.expires_at ? inv.expires_at <= nowIso : true);
          if (!invExpired) continue;

          const { data: upd } = await supabaseAdmin
            .from("transactions")
            .update({
              status: "rejected",
              drained_at: nowIso,
              note: `auto-drained: pending > ${STALE_TXN_HOURS}h with no matching SMS`,
            })
            .eq("id", t.id)
            .eq("status", "pending")
            .select("id");
          if (upd && upd.length > 0) drained++;
        }

        console.log(`[drain] replayed=${replayed} verified=${verified} drained=${drained}`);
        return Response.json({ ok: true, replayed, verified, drained });
      },
    },
  },
});
