import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertSuperAdmin(context: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

export async function logAudit(
  context: { supabase: SupabaseClient; userId: string },
  action: string,
  merchant_id: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: context.userId,
    merchant_id,
    action,
    resource: "merchant",
    resource_id: merchant_id,
    metadata,
  });
}