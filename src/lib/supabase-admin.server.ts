/**
 * Server-only re-export of the admin Supabase client that first installs the
 * `ws` WebSocket polyfill. Supabase's RealtimeClient throws
 * "Node.js 20 detected without native WebSocket support" during
 * `supabase.auth.admin.*` calls under Node.js < 22 (e.g. Coolify Node 20).
 * Import this module instead of `@/integrations/supabase/client.server`
 * from every server fn / server route handler.
 */
import "@/lib/ws-polyfill.server";
export { supabaseAdmin } from "@/integrations/supabase/client.server";
