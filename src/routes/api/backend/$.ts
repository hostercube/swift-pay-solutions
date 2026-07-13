import { createFileRoute } from "@tanstack/react-router";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const BACKEND_URL_ENV_PRIORITY = [
  "SERVICE_URL_SUPABASEKONG_8000",
  "SERVICE_URL_SUPABASEKONG",
  "PAYNOC_PRODUCTION_SUPABASE_URL",
  "PAYNOC_PROD_SUPABASE_URL",
  "PAYNOC_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
] as const;

function envValue(name: string) {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ];
}

function resolveBackendOrigin() {
  for (const name of BACKEND_URL_ENV_PRIORITY) {
    const value = envValue(name)?.trim();
    if (value) return value.replace(/\/+$/, "");
  }
  throw new Error("Backend API URL is not configured");
}

function targetUrl(request: Request) {
  const incoming = new URL(request.url);
  const backend = new URL(resolveBackendOrigin());
  const suffix = incoming.pathname.replace(/^\/api\/backend\/?/, "");
  backend.pathname = `${backend.pathname.replace(/\/+$/, "")}/${suffix}`.replace(/\/+/g, "/");
  backend.search = incoming.search;
  return backend.toString();
}

function forwardedHeaders(request: Request) {
  const headers = new Headers(request.headers);
  for (const name of Array.from(headers.keys())) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) headers.delete(name);
  }
  headers.delete("host");
  return headers;
}

function responseHeaders(response: Response) {
  const headers = new Headers(response.headers);
  for (const name of Array.from(headers.keys())) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) headers.delete(name);
  }
  return headers;
}

async function proxyBackend(request: Request) {
  try {
    const method = request.method.toUpperCase();
    const upstream = await fetch(targetUrl(request), {
      method,
      headers: forwardedHeaders(request),
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream),
    });
  } catch (error) {
    console.error("[backend-gateway] request failed", error);
    return new Response(
      JSON.stringify({
        error: "backend_unreachable",
        message: "Backend API gateway is unreachable from the app server.",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

export const Route = createFileRoute("/api/backend/$")({
  server: {
    handlers: {
      DELETE: ({ request }) => proxyBackend(request),
      GET: ({ request }) => proxyBackend(request),
      HEAD: ({ request }) => proxyBackend(request),
      OPTIONS: ({ request }) => proxyBackend(request),
      PATCH: ({ request }) => proxyBackend(request),
      POST: ({ request }) => proxyBackend(request),
      PUT: ({ request }) => proxyBackend(request),
    },
  },
});