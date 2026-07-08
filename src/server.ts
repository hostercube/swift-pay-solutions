import "./lib/ws-polyfill.server";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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

function rewriteForSubdomain(request: Request): Request {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (!host.endsWith("." + APEX_DOMAIN) && host !== APEX_DOMAIN) return request;

  const sub =
    host === APEX_DOMAIN || host === "www." + APEX_DOMAIN
      ? ""
      : host.slice(0, host.length - APEX_DOMAIN.length - 1);

  const p = url.pathname;
  const isAsset =
    p.startsWith("/_build") ||
    p.startsWith("/assets") ||
    p.startsWith("/@") ||
    p.startsWith("/__") ||
    p === "/favicon.ico" ||
    p === "/embed.js" ||
    p === "/robots.txt" ||
    p === "/sitemap.xml";
  if (isAsset) return request;

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
    if (!p.startsWith("/docs") && !p.startsWith("/api-reference")) {
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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const rewritten = rewriteForSubdomain(request);
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

