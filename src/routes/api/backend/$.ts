import { createFileRoute } from "@tanstack/react-router";

// Same-origin proxy to the PayNOC backend (Supabase API gateway).
// The browser calls /api/backend/* which we forward server-side to the real
// backend URL. This removes the browser's dependency on db.paynoc.com being
// publicly reachable, having valid SSL, and being CORS-configured for the
// site origin. If the site loads, the backend works.

const HOP_BY_HOP = new Set([
  "connection",
  "content-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function stripHopByHop(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

async function proxy(request: Request, splat: string): Promise<Response> {
  const { getPaynocBackendEnv } = await import("@/lib/paynoc-env.server");
  const { url: backendUrl } = getPaynocBackendEnv();
  if (!backendUrl) {
    return new Response("Backend URL not configured", { status: 502 });
  }

  const incoming = new URL(request.url);
  const target = new URL(backendUrl.replace(/\/+$/, "") + "/" + splat);
  target.search = incoming.search;

  const headers = stripHopByHop(request.headers);
  // The server runtime may transparently decompress upstream responses. Force
  // identity encoding and strip any remaining content-encoding header so the
  // browser never receives a decoded body labelled as gzip/br.
  headers.set("accept-encoding", "identity");

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Backend unreachable: ${message}`, { status: 502 });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: stripHopByHop(response.headers),
  });
}

export const Route = createFileRoute("/api/backend/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => proxy(request, params._splat ?? ""),
      POST: async ({ request, params }) => proxy(request, params._splat ?? ""),
      PUT: async ({ request, params }) => proxy(request, params._splat ?? ""),
      PATCH: async ({ request, params }) => proxy(request, params._splat ?? ""),
      DELETE: async ({ request, params }) => proxy(request, params._splat ?? ""),
      OPTIONS: async ({ request, params }) => proxy(request, params._splat ?? ""),
      HEAD: async ({ request, params }) => proxy(request, params._splat ?? ""),
    },
  },
});
