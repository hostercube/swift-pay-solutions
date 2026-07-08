// Permission catalogs used by admin office staff and merchant team members.
// Grouped so the staff page can render a clean matrix.

export const ADMIN_PERM_GROUPS = [
  {
    group: "Merchants",
    perms: [
      { key: "merchants.view",       label: "View merchants" },
      { key: "merchants.edit",       label: "Edit profile / brand" },
      { key: "merchants.suspend",    label: "Suspend / reactivate" },
      { key: "merchants.delete",     label: "Delete merchants" },
      { key: "merchants.impersonate",label: "Impersonate (login as)" },
      { key: "merchants.password",   label: "Reset password / magic link" },
    ],
  },
  {
    group: "KYC",
    perms: [
      { key: "kyc.review",   label: "Review submissions" },
      { key: "kyc.override", label: "Force-verify / override" },
    ],
  },
  {
    group: "Money",
    perms: [
      { key: "payouts.view",    label: "View payouts" },
      { key: "payouts.approve", label: "Approve payouts" },
      { key: "refunds.view",    label: "View refunds" },
      { key: "refunds.issue",   label: "Issue refunds" },
      { key: "fx.manage",       label: "Manage FX rates" },
      { key: "disputes.manage", label: "Manage disputes" },
    ],
  },
  {
    group: "Operations",
    perms: [
      { key: "transactions.view", label: "View all transactions" },
      { key: "invoices.view",     label: "View all invoices" },
      { key: "webhooks.view",     label: "Webhook health" },
      { key: "api_keys.view",     label: "Inspect API keys" },
      { key: "incidents.manage",  label: "Manage incidents" },
    ],
  },
  {
    group: "Platform",
    perms: [
      { key: "gateways.manage",  label: "Platform gateways" },
      { key: "plugins.manage",   label: "Plugins & SDKs" },
      { key: "broadcast.send",   label: "Send broadcast notifications" },
      { key: "settings.manage",  label: "Platform settings" },
      { key: "audit.view",       label: "Audit logs" },
      { key: "staff.manage",     label: "Manage admin staff" },
      { key: "packages",         label: "Manage subscription packages" },
    ],
  },
] as const;

export type AdminPermItem = { key: string; label: string };
export const ADMIN_PERMS: readonly AdminPermItem[] = ADMIN_PERM_GROUPS.flatMap(
  (g) => g.perms as readonly AdminPermItem[],
);
export type AdminPerm = string;

export const MERCHANT_PERMS = [
  { key: "invoices", label: "Invoices" },
  { key: "transactions", label: "Transactions" },
  { key: "methods", label: "Payment methods" },
  { key: "payouts", label: "Payouts" },
  { key: "refunds", label: "Refunds" },
  { key: "disputes", label: "Disputes" },
  { key: "reports", label: "Reports" },
  { key: "api_keys", label: "API keys" },
  { key: "webhooks", label: "Webhooks" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
] as const;
export type MerchantPerm = (typeof MERCHANT_PERMS)[number]["key"];
