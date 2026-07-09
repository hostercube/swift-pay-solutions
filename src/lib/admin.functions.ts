import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

async function logAudit(
  context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string },
  action: string,
  merchant_id: string | null,
  metadata: Record<string, unknown> = {},
) {
  await context.supabase.from("audit_logs").insert({
    actor_id: context.userId,
    merchant_id,
    action,
    resource: "merchant",
    resource_id: merchant_id,
    metadata,
  });
}

/** Admin creates a merchant account (no email confirmation needed). */
export const adminCreateMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        full_name: z.string().optional(),
        business_name: z.string().optional(),
        phone: z.string().optional(),
        verified: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        business_name: data.business_name,
        phone: data.phone,
      },
    });
    if (error) throw new Error(error.message);

    if (data.verified && created.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ kyc_status: "verified", kyc_reviewed_at: new Date().toISOString() })
        .eq("id", created.user.id);
    }
    await logAudit(context, "merchant.created", created.user?.id ?? null, { email: data.email });
    return { id: created.user?.id, email: created.user?.email };
  });

/** Admin generates a one-time magic link to sign in as any merchant. */
export const adminImpersonate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ target_user_id: z.string().uuid(), reason: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

    const { data: userRow, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.target_user_id);
    if (uErr || !userRow.user?.email) throw new Error(uErr?.message ?? "Merchant not found");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userRow.user.email,
    });
    if (linkErr) throw new Error(linkErr.message);

    const { data: me } = await context.supabase.auth.getUser();
    await context.supabase.from("impersonation_events").insert({
      admin_user_id: context.userId,
      admin_email: me.user?.email ?? "",
      target_user_id: data.target_user_id,
      target_email: userRow.user.email,
      reason: data.reason,
    });
    await logAudit(context, "merchant.impersonated", data.target_user_id, { reason: data.reason });

    return { action_link: link.properties?.action_link ?? null, email: userRow.user.email };
  });

/** Force KYC state (verified / rejected / unverified / pending). */
export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        merchant_id: z.string().uuid(),
        decision: z.enum(["verified", "rejected", "unverified", "pending"]),
        note: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({
        kyc_status: data.decision,
        kyc_reviewer_note: data.note ?? null,
        kyc_reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.merchant_id);
    if (error) throw new Error(error.message);
    await logAudit(context, "kyc.override", data.merchant_id, { decision: data.decision });
    return { ok: true };
  });

/** Update any editable merchant profile field. */
export const adminUpdateMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        merchant_id: z.string().uuid(),
        patch: z.object({
          full_name: z.string().nullable().optional(),
          business_name: z.string().nullable().optional(),
          phone: z.string().nullable().optional(),
          slug: z.string().nullable().optional(),
          brand_color: z.string().nullable().optional(),
          logo_url: z.string().nullable().optional(),
          support_email: z.string().nullable().optional(),
          checkout_footer: z.string().nullable().optional(),
          public_bio: z.string().nullable().optional(),
          accept_tips: z.boolean().optional(),
          tip_min_amount: z.number().optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update(data.patch)
      .eq("id", data.merchant_id);
    if (error) throw new Error(error.message);
    await logAudit(context, "merchant.updated", data.merchant_id, { fields: Object.keys(data.patch) });
    return { ok: true };
  });

/** Suspend or reactivate. Blocks API + checkout by convention (status=suspended). */
export const adminSetMerchantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        merchant_id: z.string().uuid(),
        status: z.enum(["active", "suspended", "pending"]),
        reason: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.merchant_id);
    if (error) throw new Error(error.message);

    // If suspending, also deactivate their API keys so nothing keeps flowing.
    if (data.status === "suspended") {
      await context.supabase.from("api_keys").update({ is_active: false }).eq("merchant_id", data.merchant_id);
    }
    await logAudit(context, `merchant.${data.status}`, data.merchant_id, { reason: data.reason });
    return { ok: true };
  });

/** Send a password recovery email or return a one-time recovery link. */
export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ merchant_id: z.string().uuid(), mode: z.enum(["email", "link"]).default("link") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: u, error: e1 } = await supabaseAdmin.auth.admin.getUserById(data.merchant_id);
    if (e1 || !u.user?.email) throw new Error(e1?.message ?? "Merchant not found");

    const { data: link, error: e2 } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
    });
    if (e2) throw new Error(e2.message);
    await logAudit(context, "merchant.password_reset", data.merchant_id, { mode: data.mode });
    return { email: u.user.email, action_link: link.properties?.action_link ?? null };
  });

/** Delete a merchant entirely (auth user + profile cascade). */
export const adminDeleteMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ merchant_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.merchant_id);
    if (error) throw new Error(error.message);
    await logAudit(context, "merchant.deleted", data.merchant_id);
    return { ok: true };
  });

/** Aggregated merchant profile for the admin deep-dive page. */
export const adminGetMerchantOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ merchant_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const s = context.supabase;
    const mid = data.merchant_id;

    const [
      profile,
      roles,
      methods,
      byoGateways,
      apiKeys,
      invoiceStats,
      txStats,
      recentInvoices,
      recentPayouts,
      teamMembers,
      webhookStats,
    ] = await Promise.all([
      s.from("profiles").select("*").eq("id", mid).maybeSingle(),
      s.from("user_roles").select("role").eq("user_id", mid),
      s.from("payment_methods").select("id, type, label, is_active, sort_order").eq("merchant_id", mid),
      s.from("byo_gateways").select("id, provider, is_active, created_at").eq("merchant_id", mid),
      s.from("api_keys").select("id, name, public_key, environment, is_active, last_used_at, created_at").eq("merchant_id", mid),
      s.from("invoices").select("status, amount").eq("merchant_id", mid),
      s.from("transactions").select("status, gross_amount").eq("merchant_id", mid),
      s.from("invoices").select("id, invoice_number, amount, currency, status, created_at, customer_email").eq("merchant_id", mid).order("created_at", { ascending: false }).limit(10),
      s.from("payouts").select("id, amount, currency, status, created_at, processed_at").eq("merchant_id", mid).order("created_at", { ascending: false }).limit(10),
      s.from("team_members").select("id, member_email, role, status").eq("merchant_id", mid),
      s.from("webhook_deliveries").select("status").eq("merchant_id", mid),
    ]);

    const inv = invoiceStats.data ?? [];
    const tx = txStats.data ?? [];
    const wh = webhookStats.data ?? [];

    return {
      profile: profile.data,
      is_super_admin: (roles.data ?? []).some((r) => r.role === "super_admin"),
      counts: {
        invoices: inv.length,
        invoices_paid: inv.filter((i) => i.status === "completed").length,
        transactions: tx.length,
        transactions_verified: tx.filter((t) => t.status === "verified").length,
        gross_volume: tx.filter((t) => t.status === "verified").reduce((s2, t) => s2 + Number(t.gross_amount ?? 0), 0),
        webhooks_delivered: wh.filter((w) => w.status === "success").length,
        webhooks_failed: wh.filter((w) => w.status === "failed").length,
      },
      methods: methods.data ?? [],
      byo_gateways: byoGateways.data ?? [],
      api_keys: apiKeys.data ?? [],
      recent_invoices: recentInvoices.data ?? [],
      recent_payouts: recentPayouts.data ?? [],
      team_members: teamMembers.data ?? [],
    };
  });

/** Broadcast an in-app notification to all merchants (or a filtered subset). */
export const adminBroadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(160),
        body: z.string().min(1).max(2000),
        audience: z.enum(["all", "active", "suspended", "kyc_pending"]).default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    let q = context.supabase.from("profiles").select("id, status, kyc_status");
    if (data.audience === "active") q = q.eq("status", "active");
    else if (data.audience === "suspended") q = q.eq("status", "suspended");
    else if (data.audience === "kyc_pending") q = q.in("kyc_status", ["pending", "unverified"]);
    const { data: targets, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (targets ?? []).map((t) => ({
      merchant_id: t.id,
      event: "admin.broadcast",
      title: data.title,
      body: data.body,
      metadata: { audience: data.audience },
    }));
    if (rows.length === 0) return { sent: 0 };

    const { error: insertErr } = await context.supabase.from("notifications").insert(rows);
    if (insertErr) throw new Error(insertErr.message);
    await logAudit(context, "broadcast.sent", null, { audience: data.audience, count: rows.length, title: data.title });
    return { sent: rows.length };
  });

/** Change a merchant subscription: swap package, edit end date, toggle auto-renew, or force a status. */
export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subscription_id: z.string().uuid(),
        package_id: z.string().uuid().optional(),
        current_period_end: z.string().datetime().nullable().optional(),
        auto_renew: z.boolean().optional(),
        status: z.enum(["active", "trialing", "cancelled", "expired", "past_due"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

    const patch: Record<string, unknown> = {};
    if (data.package_id) patch.package_id = data.package_id;
    if (data.current_period_end !== undefined) patch.current_period_end = data.current_period_end;
    if (data.auto_renew !== undefined) patch.auto_renew = data.auto_renew;
    if (data.status) {
      patch.status = data.status;
      if (data.status === "cancelled") patch.cancelled_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: current, error: readErr } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("merchant_id, package_id")
      .eq("id", data.subscription_id)
      .maybeSingle();
    if (readErr || !current) throw new Error(readErr?.message ?? "Subscription not found");

    const { error } = await supabaseAdmin
      .from("merchant_subscriptions")
      .update(patch as never)
      .eq("id", data.subscription_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("subscription_events").insert({
      subscription_id: data.subscription_id,
      merchant_id: current.merchant_id,
      package_id: data.package_id ?? current.package_id,
      event_type: data.package_id ? "package_changed" : "updated",
      note: `Admin update: ${Object.keys(patch).join(", ")}`,
    });
    await logAudit(context, "subscription.updated", current.merchant_id, {
      subscription_id: data.subscription_id,
      fields: Object.keys(patch),
    });
    return { ok: true };
  });
