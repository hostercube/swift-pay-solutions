import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MERCHANT_PERMS, type MerchantPerm } from "@/lib/permissions";

const ALL: MerchantPerm[] = MERCHANT_PERMS.map((p) => p.key);

/**
 * Returns the effective merchant permission set for the signed-in user
 * in the context of their own merchant account.
 * - Merchant owner (own account): all permissions.
 * - Team member: the permissions ticked on their team_members row.
 */
export function useMerchantPerms() {
  const { user } = useAuth();
  const [perms, setPerms] = useState<MerchantPerm[]>(ALL);
  const [isOwner, setIsOwner] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // If a team_members row exists where THIS user is a member (member_user_id),
      // they are a teammate on someone else's merchant.
      const { data } = await supabase
        .from("team_members")
        .select("permissions, merchant_id")
        .eq("member_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (data) {
        setIsOwner(false);
        setPerms((data.permissions ?? []) as MerchantPerm[]);
      } else {
        setIsOwner(true);
        setPerms(ALL);
      }
      setReady(true);
    })();
  }, [user]);

  return {
    ready,
    isOwner,
    perms,
    // Until the team_members lookup resolves we grant nothing, so a restricted
    // team member never sees permission-gated nav items flash on load.
    has: (p: MerchantPerm) => ready && (isOwner || perms.includes(p)),
  };
}
