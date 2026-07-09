
# Pagination + Search + Filters — Everywhere

## Goal
Add consistent pagination, keyword search, and advanced filters to every table across the merchant portal, admin portal, and any other panels — without rewriting each page from scratch.

## Approach
Build ONE reusable primitive and roll it out. No per-page pagination code.

### 1. New primitive: `src/components/data-table.tsx`
A single generic component used by every listing page.

Props (typed generic `<T>`):
- `columns`: `{ key, label, render?, sortable?, className? }[]`
- `rows`: `T[]` (full dataset OR server-paged slice)
- `searchable?`: `(row: T) => string` — enables the search box
- `filters?`: `{ key, label, options: {value,label}[], match: (row, value) => boolean }[]` — dropdown filters above the table
- `dateField?`: string — enables From/To date range filter
- `pageSize?`: default 20; user-adjustable (10/20/50/100)
- `emptyMessage?`
- `serverPagination?`: `{ page, total, onPageChange, onSearchChange, onFilterChange }` — opt-in mode for very large tables

Client mode (default): does filtering + search + pagination in memory.
Server mode: parent controls state and passes slices back.

URL sync: reads `?q=&page=&pageSize=&<filterKey>=` via `useSearch`/`useNavigate` so refresh + share-link works. Uses `fallback()` from `@tanstack/zod-adapter` per project rules.

### 2. Rollout — replace hand-rolled `<table>`s with `<DataTable>`

Merchant pages:
- invoices.index, transactions, refunds, disputes, recurring, discounts, notifications.index, api-logs, webhooks, team, domains, security.api-keys, security.devices, security.ip-whitelist, security.fraud, integrations.byo, integrations.api, integrations.reviews, notifications.digest, marketing

Admin pages:
- admin/merchants.index, admin/invoices, admin/transactions, admin/kyc, admin/staff, admin/audit, admin/packages, admin/fx, admin/smsnoc, admin/platform.plugins, admin/platform.webhooks, admin/platform.incidents

Each conversion is small: define `columns`, optional `filters`, pass `rows` — delete the manual `<thead>/<tbody>/pagination` block.

### 3. Filter presets per domain
- Invoices/transactions: status filter, method filter, date range
- Refunds/disputes: status
- KYC/merchants: status, KYC state, date range
- Audit/api-logs: action/level, date range
- Team/staff: role, status
- Webhooks/deliveries: status code bucket (2xx/4xx/5xx)

### 4. Delivery in stages (single PR)
Because ~30 pages: I'll ship them in ONE turn but grouped commits inside my edits:
1. `data-table.tsx` primitive + tiny `useTableSearch` URL hook
2. Convert merchant listing pages (batch 1)
3. Convert admin listing pages (batch 2)
4. Convert security/integrations pages (batch 3)

## Non-goals
- No backend/API changes. All filtering is client-side unless a page is already server-paginated.
- No visual redesign — reuse existing card/glass styling.
- Fraud blocklist and other <10-row tables get search only; pagination stays hidden until >`pageSize` rows exist.

## Risks
- A few admin pages (e.g. transactions/audit) can grow large. Those get `serverPagination` in a follow-up if needed; for now client-side with `pageSize=50` is fine — queries already `.limit(200-500)`.
- URL search sync could conflict with existing route `validateSearch` on a couple of pages (invoices.index has one). The primitive will accept an optional `stateMode: "url" | "local"` — I'll use `local` on routes that already own their search schema to avoid clashes.

Ready to build.
