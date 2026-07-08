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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRow, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.target_user_id);
    if (uErr || !userRow.user?.email) throw new Error(uErr?.message ?? "Merchant not found");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userRow.user.email,
    });
    if (linkErr) throw new Error(linkErr.message);

    // Audit
    const { data: me } = await context.supabase.auth.getUser();
    await context.supabase.from("impersonation_events").insert({
      admin_user_id: context.userId,
      admin_email: me.user?.email ?? "",
      target_user_id: data.target_user_id,
      target_email: userRow.user.email,
      reason: data.reason,
    });

    return { action_link: link.properties?.action_link ?? null, email: userRow.user.email };
  });

/** Admin reviews KYC. */
export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        merchant_id: z.string().uuid(),
        decision: z.enum(["verified", "rejected"]),
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
    return { ok: true };
  });
