// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import process from "node:process";

const isLovablePreview = Boolean(
  process.env.LOVABLE_SANDBOX ||
    process.env.LOVABLE_PREVIEW_HOST ||
    process.env.LOVABLE_PROJECT_ID,
);

const isSelfHostedNodeBuild =
  process.env.PAYNOC_DOCKER_TARGET === "node" ||
  process.env.NITRO_PRESET === "node-server" ||
  process.env.NITRO_PRESET === "node";

const pickEnv = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value;
  }
  return undefined;
};

const PAYNOC_SUPABASE_URL = pickEnv(
  "VITE_SUPABASE_URL",
  "PAYNOC_SUPABASE_URL",
  "PAYNOC_PRODUCTION_SUPABASE_URL",
  "PAYNOC_PROD_SUPABASE_URL",
  "SUPABASE_URL",
  "SERVICE_URL_SUPABASEKONG",
  "SERVICE_URL_SUPABASEKONG_8000",
);

const PAYNOC_SUPABASE_ANON_KEY = pickEnv(
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "PAYNOC_SUPABASE_ANON_KEY",
  "PAYNOC_SUPABASE_PUBLISHABLE_KEY",
  "PAYNOC_PRODUCTION_SUPABASE_ANON_KEY",
  "PAYNOC_PRODUCTION_SUPABASE_PUBLISHABLE_KEY",
  "PAYNOC_PROD_SUPABASE_ANON_KEY",
  "PAYNOC_PROD_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SERVICE_SUPABASEANON_KEY",
);

const PAYNOC_SUPABASE_PROJECT_ID =
  pickEnv(
    "VITE_SUPABASE_PROJECT_ID",
    "PAYNOC_SUPABASE_PROJECT_ID",
    "PAYNOC_PRODUCTION_SUPABASE_PROJECT_ID",
    "PAYNOC_PROD_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_ID",
  ) ?? "paynoc";

const SUPABASE_URL_FOR_CLIENT = isLovablePreview
  ? pickEnv("VITE_SUPABASE_URL", "SUPABASE_URL")
  : PAYNOC_SUPABASE_URL;

const SUPABASE_ANON_KEY_FOR_CLIENT = isLovablePreview
  ? pickEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    )
  : PAYNOC_SUPABASE_ANON_KEY;

const SUPABASE_PROJECT_ID_FOR_CLIENT = isLovablePreview
  ? (pickEnv("VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID") ?? "paynoc")
  : PAYNOC_SUPABASE_PROJECT_ID;

// Only override Vite's own VITE_* env injection when we resolved a real value
// from a non-VITE source (i.e. an operator explicitly set PAYNOC_* / SERVICE_*).
// Falling back to a hardcoded host caused prod to hit an unreachable Supabase
// and fail login with "Failed to fetch".
const supabaseDefines: Record<string, string> = {};
if (SUPABASE_URL_FOR_CLIENT) {
  supabaseDefines["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(SUPABASE_URL_FOR_CLIENT);
}
if (SUPABASE_ANON_KEY_FOR_CLIENT) {
  supabaseDefines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(SUPABASE_ANON_KEY_FOR_CLIENT);
  supabaseDefines["import.meta.env.VITE_SUPABASE_ANON_KEY"] = JSON.stringify(SUPABASE_ANON_KEY_FOR_CLIENT);
}
supabaseDefines["import.meta.env.VITE_SUPABASE_PROJECT_ID"] = JSON.stringify(SUPABASE_PROJECT_ID_FOR_CLIENT);

export default defineConfig({
  nitro: isSelfHostedNodeBuild ? { preset: "node-server" } : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: supabaseDefines,
  },
});
