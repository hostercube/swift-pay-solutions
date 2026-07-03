# ---- PayNOC — Dockerfile for Coolify / any Docker host ----
# Builds a Node server (Nitro node-server preset) that serves SSR + APIs.
#
# NOTE: bun:1.2-alpine ships Bun 1.2+ (new text lockfile format) AND a
# Node runtime new enough (22.13+) for Vite 8. bun:1.1 ships Bun 1.1.x +
# Node 22.6 which crashes Vite with "Export named 'parseEnv' not found
# in module 'util'". Don't downgrade this image.

FROM oven/bun:1.2-alpine AS build
WORKDIR /app
COPY package.json bun.lock* bunfig.toml ./
RUN bun install --frozen-lockfile || bun install
COPY . .
ENV NITRO_PRESET=node-server
# Public envs baked at build time — Coolify injects them as build args/env.
# Only PUBLISHABLE (anon) keys go here — never SERVICE_ROLE_KEY, that's
# runtime-only and must stay out of the built image.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
