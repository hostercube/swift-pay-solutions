export type CheckoutStyle = "premium" | "classic" | "neon" | "minimal";

export type Invoice = {
  id: string;
  merchant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  method_id: string | null;
  method_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  redirect_url: string | null;
  expires_at: string | null;
  mode: string;
  display_currency?: string | null;
  discount_amount?: number | null;
  discount_code?: string | null;
  allow_custom_amount?: boolean | null;
  min_amount?: number | null;
  max_amount?: number | null;
  reusable?: boolean | null;
  auto_redirect?: boolean | null;
};

export type Method = {
  id: string;
  merchant_id: string;
  type: string;
  label: string;
  mode: "manual" | "api";
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
  fee_percent: number;
  fee_flat: number;
  min_amount: number | null;
  max_amount: number | null;
  qr_code_url: string | null;
  qr_type: string | null;
  bank_name: string | null;
  branch_name: string | null;
  routing_number: string | null;
  swift_code: string | null;
};

export type Txn = {
  id: string;
  status: string;
  method_type: string;
  gross_amount: number;
  provider_txn_id: string | null;
  reference: string | null;
  created_at: string;
  verified_at: string | null;
  note: string | null;
};

export type Brand = {
  business_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  checkout_footer: string | null;
  checkout_style?: CheckoutStyle | null;
  ga4_measurement_id?: string | null;
  gtm_container_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  custom_head_html?: string | null;
  custom_footer_html?: string | null;
};

export type Gw = { id?: string; provider: string; mode: string; label?: string | null };

export type ManualFormState = {
  sender_number: string;
  sender_name: string;
  provider_txn_id: string;
  bank_reference: string;
  slip_url: string;
};

export const AUTO_GATEWAYS = new Set([
  "bkash", "sslcommerz", "stripe", "razorpay", "coinbase_commerce",
  "nowpayments", "paypal", "uddoktapay", "piprapay", "ownpay",
]);
