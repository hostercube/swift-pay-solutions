import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProviderToggle = {
  provider: string;
  category: "bd" | "international" | "crypto" | "manual";
  label: string;
  enabled: boolean;
  updated_at: string;
};

/** Set of provider ids that are currently enabled (admin ON). Defaults to
 * all-enabled while loading so the UI doesn't briefly hide everything. */
export function useEnabledProviders() {
  const [set, setSet] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gateway_provider_toggles" as never)
        .select("provider, enabled");
      if (cancelled) return;
      const arr = (data ?? []) as Array<{ provider: string; enabled: boolean }>;
      setSet(new Set(arr.filter((r) => r.enabled).map((r) => r.provider)));
    })();
    return () => { cancelled = true; };
  }, []);
  return {
    ready: set !== null,
    isEnabled: (provider: string) => (set ? set.has(provider) : true),
  };
}
