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

function resolveBackendOrigins() {
  const origins: string[] = [];
  for (const name of BACKEND_URL_ENV_PRIORITY) {
    const value = envValue(name)?.trim();
    if (!value) continue;
    const normalized = value.replace(/\/+$/, "");
    if (!origins.includes(normalized)) origins.push(normalized);
  }
  if (!origins.length) throw new Error("Backend API URL is not configured");
  return origins;
}

function targetUrl(request: Request, origin: string) {
  const incoming = new URL(request.url);
  const backend = new URL(origin);
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

function looksLikeWrongService(request: Request, response: Response) {
  if (response.status !== 404 && response.status !== 502) return false;
  const pathname = new URL(request.url).pathname;
  if (
    !pathname.startsWith("/api/backend/auth/v1/") &&
    !pathname.startsWith("/api/backend/rest/v1/") &&
    !pathname.startsWith("/api/backend/storage/v1/")
  ) {
    return false;
  }
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/html");
}

async function proxyBackend(request: Request) {
  const method = request.method.toUpperCase();
  const headers = forwardedHeaders(request);
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  let lastError: unknown;

  try {
    for (const origin of resolveBackendOrigins()) {
      try {
        const upstream = await fetch(targetUrl(request, origin), {
          method,
          headers,
          body,
          redirect: "manual",
        });

        if (looksLikeWrongService(request, upstream)) {
          lastError = new Error(`Backend URL ${origin} is not the API gateway`);
          continue;
        }

        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders(upstream),
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Backend API URL is unreachable");
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