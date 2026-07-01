import type { SupabaseClient } from "@supabase/supabase-js";

export type MerchantRole = "owner" | "admin" | "operator" | "viewer";

/**
 * Assert the caller has at least the given role on the given merchant.
 * Throws when access is denied. Uses the request-scoped supabase client
 * so RLS + the DB `merchant_can` helper enforce the check server-side.
 */
export async function assertMerchantRole(
  supabase: SupabaseClient,
  userId: string,
  merchantId: string,
  minRole: Exclude<MerchantRole, "owner">,
): Promise<void> {
  const { data, error } = await supabase.rpc("merchant_can", {
    _user_id: userId,
    _merchant_id: merchantId,
    _min_role: minRole,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Forbidden: requires ${minRole} role`);
}
