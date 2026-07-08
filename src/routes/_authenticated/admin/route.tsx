import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: ok } = await supabase.rpc("is_admin_office", { _user_id: userData.user.id });
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
