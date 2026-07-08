/**
 * Node.js < 22 (Coolify/Docker Node 20) has no global WebSocket, and Supabase
 * Realtime's client throws "Node.js 20 detected without native WebSocket support"
 * as soon as the internal RealtimeClient tries to authenticate — even for
 * non-realtime calls like `auth.admin.createUser`.
 *
 * Import this module BEFORE `client.server` (or any other module that
 * instantiates a Supabase client on the server) to install the `ws` polyfill
 * onto globalThis. Safe no-op when a native WebSocket already exists (browsers,
 * Node.js 22+, Cloudflare Workers).
 */
import WebSocketImpl from "ws";

const g = globalThis as unknown as { WebSocket?: unknown };
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = WebSocketImpl as unknown as typeof WebSocket;
}

export {};
