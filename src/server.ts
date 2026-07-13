import "./lib/ws-polyfill.server";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { applyPaynocBackendEnv } from "./lib/paynoc-env.server";

applyPaynocBackendEnv();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// -------------------------------------------------------------------
// Subdomain routing — one deploy serves multiple subdomains:
//   paynoc.bd / www.paynoc.bd  → main site (marketing, auth, dashboards)
//   pay.paynoc.bd/<invoiceId>  → hosted checkout (/pay/<invoiceId>)
//   docs.paynoc.bd             → documentation   (/docs)
//   api.paynoc.bd/*            → REST API        (/api/*)
// Rewrites happen BEFORE TanStack Start sees the request, so route
// files stay unchanged. Override APEX_DOMAIN via env for other domains.
// -------------------------------------------------------------------
const APEX_DOMAIN =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.APEX_DOMAIN ?? "paynoc.bd";

const ASSET_PREFIXES = ["/_build", "/assets", "/@", "/__"];
const ASSET_EXACT = new Set(["/favicon.ico", "/embed.js", "/robots.txt", "/sitemap.xml"]);

function isAssetPath(p: string) {
  if (ASSET_EXACT.has(p)) return true;
  return ASSET_PREFIXES.some((prefix) => p.startsWith(prefix));
}

// -------- White-label merchant domain resolution --------
type MerchantDomain = { slug: string; use_for: string } | null;
const domainCache = new Map<string, { value: MerchantDomain; exp: number }>();
const DOMAIN_TTL_MS = 5 * 60 * 1000;

async function resolveMerchantDomain(host: string): Promise<MerchantDomain> {
  const cached = domainCache.get(host);
  if (cached && cached.exp > Date.now()) return cached.value;

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env ?? {};
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/resolve_merchant_domain`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ _host: host }),
    });
    if (!res.ok) {
      domainCache.set(host, { value: null, exp: Date.now() + 30_000 });
      return null;
    }
    const data = (await res.json()) as Array<{ slug: string; use_for: string }> | null;
    const row = Array.isArray(data) && data[0] ? { slug: data[0].slug, use_for: data[0].use_for } : null;
    domainCache.set(host, { value: row, exp: Date.now() + DOMAIN_TTL_MS });
    return row;
  } catch {
    return null;
  }
}

function rewriteForApexSubdomain(request: Request): Request {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (!host.endsWith("." + APEX_DOMAIN) && host !== APEX_DOMAIN) return request;

  const sub =
    host === APEX_DOMAIN || host === "www." + APEX_DOMAIN
      ? ""
      : host.slice(0, host.length - APEX_DOMAIN.length - 1);

  const p = url.pathname;
  if (isAssetPath(p)) return request;

  let newPath = p;
  if (sub === "pay") {
    if (
      !p.startsWith("/pay") &&
      !p.startsWith("/m/") &&
      !p.startsWith("/portal") &&
      !p.startsWith("/status")
    ) {
      newPath = p === "/" ? "/pay" : "/pay" + p;
    }
  } else if (sub === "docs") {
    if (!p.startsWith("/docs")) {
      newPath = p === "/" ? "/docs" : "/docs" + p;
    }
  } else if (sub === "api") {
    if (!p.startsWith("/api/")) {
      newPath = "/api" + (p === "/" ? "" : p);
    }
  }

  if (newPath === p) return request;
  url.pathname = newPath;
  return new Request(url.toString(), request);
}

async function rewriteForMerchantDomain(request: Request): Promise<Request> {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // Skip known infra hosts
  if (
    host === APEX_DOMAIN ||
    host.endsWith("." + APEX_DOMAIN) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev")
  ) {
    return request;
  }

  const p = url.pathname;
  if (isAssetPath(p) || p.startsWith("/api/")) return request;

  const resolved = await resolveMerchantDomain(host);
  if (!resolved) return request;

  // Route by first path segment so merchants get their own multi-page site
  // under their custom domain (checkout, portal, invoice pages).
  let newPath = p;
  if (p === "/" || p === "") {
    // Root of merchant domain → their public merchant page.
    newPath = `/m/${resolved.slug}`;
  } else if (
    !p.startsWith("/pay") &&
    !p.startsWith("/portal") &&
    !p.startsWith("/status") &&
    !p.startsWith("/m/")
  ) {
    // Bare invoice id → hosted checkout
    // Any other path → prefix with /pay so custom-domain visitors land on checkout.
    newPath = "/pay" + p;
  }

  if (newPath === p) return request;
  url.pathname = newPath;
  return new Request(url.toString(), request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      applyPaynocBackendEnv(env);
      const merchantRewritten = await rewriteForMerchantDomain(request);
      const rewritten = rewriteForApexSubdomain(merchantRewritten);
      const handler = await getServerEntry();
      const response = await handler.fetch(rewritten, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

