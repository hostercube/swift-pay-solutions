// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import process from "node:process";

const pickEnv = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value;
  }
  return undefined;
};

const PAYNOC_SUPABASE_URL =
  pickEnv(
    "PAYNOC_SUPABASE_URL",
    "PAYNOC_PRODUCTION_SUPABASE_URL",
    "PAYNOC_PROD_SUPABASE_URL",
    "SERVICE_URL_SUPABASEKONG",
    "SERVICE_URL_SUPABASEKONG_8000",
  ) ?? "https://db.paynoc.bd";

const PAYNOC_SUPABASE_ANON_KEY =
  pickEnv(
    "PAYNOC_SUPABASE_ANON_KEY",
    "PAYNOC_SUPABASE_PUBLISHABLE_KEY",
    "PAYNOC_PRODUCTION_SUPABASE_ANON_KEY",
    "PAYNOC_PROD_SUPABASE_ANON_KEY",
    "SERVICE_SUPABASEANON_KEY",
  ) ??
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MzQ5NzU0MCwiZXhwIjo0OTM5MTcxMTQwLCJyb2xlIjoiYW5vbiJ9.yLlo7Ol38TufIT2ptVNz27dTI8ot9K_dzGwVTQR6QXE";

const PAYNOC_SUPABASE_PROJECT_ID =
  pickEnv(
    "PAYNOC_SUPABASE_PROJECT_ID",
    "PAYNOC_PRODUCTION_SUPABASE_PROJECT_ID",
    "PAYNOC_PROD_SUPABASE_PROJECT_ID",
  ) ?? "paynoc";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(PAYNOC_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(PAYNOC_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(PAYNOC_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(PAYNOC_SUPABASE_PROJECT_ID),
    },
  },
});
