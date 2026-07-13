import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const merchantProfileInput = z
  .object({
    email: z.string().email().optional(),
    fullName: z.string().trim().max(160).optional(),
    businessName: z.string().trim().max(200).optional(),
    businessType: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    websiteUrl: z.string().trim().max(300).optional(),
  })
  .optional();

export const ensureMerchantAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => merchantProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

    const { data: existingProfile, error: profileReadError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, business_name, phone, website, kyc_business_type")
      .eq("id", userId)
      .maybeSingle();
    if (profileReadError) throw new Error(profileReadError.message);

    let email = data?.email?.trim() || existingProfile?.email || "";
    if (!email) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError) throw new Error(userError.message);
      email = userData.user?.email ?? "";
    }
    if (!email) throw new Error("Could not find account email");

    const profilePayload = {
      id: userId,
      email,
      full_name: data?.fullName || existingProfile?.full_name || null,
      business_name: data?.businessName || existingProfile?.business_name || null,
      phone: data?.phone || existingProfile?.phone || null,
      website: data?.websiteUrl || existingProfile?.website || null,
      kyc_business_type: data?.businessType || existingProfile?.kyc_business_type || null,
    };

    const { error: profileWriteError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (profileWriteError) throw new Error(profileWriteError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "merchant" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });