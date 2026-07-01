import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MerchantRole = "owner" | "admin" | "operator" | "viewer" | null;

/**
 * Returns the caller's effective role against their active merchant account.
 * For now "active merchant" = the profile row for the signed-in user; if the
 * user is a team member of another merchant, we surface that role too.
 */
export function useMerchantRole(merchantId?: string): {
  role: MerchantRole;
  loading: boolean;
  can: (min: Exclude<MerchantRole, null | "owner">) => boolean;
} {
  const { user } = useAuth();
  const [role, setRole] = useState<MerchantRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }
      const target = merchantId ?? user.id;
      const { data } = await supabase.rpc("effective_merchant_role", {
        _user_id: user.id,
        _merchant_id: target,
      });
      if (!cancelled) {
        setRole((data as MerchantRole) ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, merchantId]);

  const rank: Record<Exclude<MerchantRole, null>, number> = {
    viewer: 1,
    operator: 2,
    admin: 3,
    owner: 4,
  };
  const can = (min: Exclude<MerchantRole, null | "owner">) =>
    !!role && rank[role] >= rank[min];

  return { role, loading, can };
}
