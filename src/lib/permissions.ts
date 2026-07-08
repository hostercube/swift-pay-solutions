// Permission catalogs used by admin office staff and merchant team members.

export const ADMIN_PERMS = [
  { key: "merchants", label: "Merchants" },
  { key: "payouts", label: "Payouts" },
  { key: "fx", label: "FX rates" },
  { key: "incidents", label: "Incidents" },
  { key: "settings", label: "Platform settings" },
  { key: "audit", label: "Audit logs" },
  { key: "staff", label: "Manage staff" },
] as const;

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

export type AdminPerm = (typeof ADMIN_PERMS)[number]["key"];
export type MerchantPerm = (typeof MERCHANT_PERMS)[number]["key"];
