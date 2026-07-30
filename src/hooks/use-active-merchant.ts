import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Resolves the merchant account the signed-in user is acting on.
 *
 * - Merchant owner → their own user id.
 * - Active team member → the id of the merchant that invited them.
 *
 * Every merchant-scoped query/insert must use this id instead of `user.id`,
 * otherwise team members read an empty dataset and write rows owned by
 * themselves instead of the merchant they manage.
 */
export function useActiveMerchant() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setMerchantId(null);
      setIsOwner(true);
      setReady(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("merchant_id")
        .eq("member_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (cancelled) return;
      const owned = !data?.merchant_id || data.merchant_id === user.id;
      setMerchantId(owned ? user.id : (data!.merchant_id as string));
      setIsOwner(owned);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { merchantId, isOwner, ready };
}
