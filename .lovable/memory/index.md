# Project Memory — PayNOC

## Core
Project: PayNOC — Self Hosted Merchant Payment Infrastructure (NOT wallet, NOT aggregator, NEVER holds merchant money).
Every merchant receives payment DIRECTLY into their own configured payment destination.
Stack (Lovable-adapted): TanStack Start + React + TS + Tailwind + shadcn + Lovable Cloud (Postgres/Auth/Storage/Server Functions).
Original spec requested NestJS/Docker/Coolify/MinIO/Android/multi-language SDKs — NOT possible in Lovable; deliver web platform equivalent only.
UI: Stripe-level, glass/modern, dark+light, responsive, animated, professional charts.
Build task-by-task: user says "task N koro", agent builds only that task.
No placeholders, no mock data, every CRUD/API/integration must be functional.
Every SQL/backend change must also be added to db/migrations before final delivery.

## Memories
- [Full PayNOC spec](mem://paynoc/full-spec) — Complete original user brief: modules, payment methods, security, DB, plugins
- [Task breakdown](mem://paynoc/tasks) — Ordered task list agent will follow when user says "task N"
