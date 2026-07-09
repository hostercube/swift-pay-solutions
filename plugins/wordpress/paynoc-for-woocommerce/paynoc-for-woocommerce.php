<?php
/**
 * Plugin Name: PayNOC for WooCommerce
 * Plugin URI:  https://paynoc.com
 * Description: Accept bKash, Nagad, Rocket, Cards and other PayNOC methods in WooCommerce. Multi-currency, HMAC-signed webhooks, hosted checkout.
 * Version:     1.0.0
 * Author:      PayNOC
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.0
 * License:     GPL-2.0-or-later
 *
 * Callback URL (auto-registered):
 *   https://YOUR-WORDPRESS-SITE/wp-json/paynoc/v1/webhook
 */

if (!defined('ABSPATH')) exit;

define('PAYNOC_WC_VERSION', '1.0.0');
define('PAYNOC_WC_FILE', __FILE__);

add_action('plugins_loaded', 'paynoc_wc_init', 11);
add_action('rest_api_init', 'paynoc_wc_register_webhook_route');

function paynoc_wc_init() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_PayNOC extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = 'paynoc';
            $this->method_title       = __('PayNOC', 'paynoc');
            $this->method_description = __('Accept bKash, Nagad, Rocket, Cards and more via PayNOC hosted checkout.', 'paynoc');
            $this->has_fields         = false;
            $this->supports           = ['products', 'refunds'];
            $this->icon               = apply_filters('paynoc_gateway_icon', '');

            $this->init_form_fields();
            $this->init_settings();

            $this->title         = $this->get_option('title', 'PayNOC');
            $this->description   = $this->get_option('description', 'Pay securely with bKash, Nagad, Rocket, or Cards.');
            $this->enabled       = $this->get_option('enabled');
            $this->api_base      = untrailingslashit((string)$this->get_option('api_base', 'https://paynoc.com'));
            $this->api_key       = (string)$this->get_option('api_key', '');
            $this->webhook_secret = (string)$this->get_option('webhook_secret', '');
            $this->mode          = (string)$this->get_option('mode', 'live');

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        }

        public function init_form_fields() {
            $callback = esc_url(rest_url('paynoc/v1/webhook'));
            $this->form_fields = [
                'enabled' => [
                    'title'   => __('Enable/Disable', 'paynoc'),
                    'type'    => 'checkbox',
                    'label'   => __('Enable PayNOC', 'paynoc'),
                    'default' => 'no',
                ],
                'title' => [
                    'title'       => __('Title', 'paynoc'),
                    'type'        => 'text',
                    'default'     => 'PayNOC',
                    'description' => __('Shown to the customer at checkout.', 'paynoc'),
                ],
                'description' => [
                    'title'   => __('Description', 'paynoc'),
                    'type'    => 'textarea',
                    'default' => 'Pay securely with bKash, Nagad, Rocket, or Cards.',
                ],
                'api_base' => [
                    'title'       => __('API Base URL', 'paynoc'),
                    'type'        => 'text',
                    'default'     => 'https://paynoc.com',
                    'description' => __('HTTPS URL of your PayNOC deployment.', 'paynoc'),
                ],
                'api_key' => [
                    'title'       => __('API Key', 'paynoc'),
                    'type'        => 'password',
                    'description' => __('From PayNOC dashboard → API Keys.', 'paynoc'),
                ],
                'webhook_secret' => [
                    'title'       => __('Webhook Signing Secret', 'paynoc'),
                    'type'        => 'password',
                    'description' => sprintf(
                        /* translators: %s: webhook URL */
                        __('From PayNOC dashboard → Webhooks. Register this callback URL there: <code>%s</code>', 'paynoc'),
                        $callback
                    ),
                ],
                'mode' => [
                    'title'   => __('Environment', 'paynoc'),
                    'type'    => 'select',
                    'options' => ['live' => 'Live', 'test' => 'Test'],
                    'default' => 'live',
                ],
            ];
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);
            if (!$order) return ['result' => 'failure'];

            if (strpos($this->api_base, 'https://') !== 0 || !$this->api_key) {
                wc_add_notice(__('PayNOC is not configured (HTTPS API base + API key required).', 'paynoc'), 'error');
                return ['result' => 'failure'];
            }

            $payload = [
                'amount'         => (float)$order->get_total(),
                'currency'       => strtoupper($order->get_currency()),
                'customer_name'  => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                'customer_email' => $order->get_billing_email(),
                'customer_phone' => $order->get_billing_phone(),
                'description'    => sprintf(__('Order #%s', 'paynoc'), $order->get_order_number()),
                'reference'      => 'wc:' . $order->get_id(),
                'redirect_url'   => $this->get_return_url($order),
                'metadata'       => ['source' => 'woocommerce', 'order_id' => $order->get_id()],
            ];

            $response = wp_remote_post($this->api_base . '/api/public/v1/invoices', [
                'timeout' => 20,
                'headers' => [
                    'Authorization'   => 'Bearer ' . $this->api_key,
                    'Content-Type'    => 'application/json',
                    'Idempotency-Key' => 'wc-' . $order->get_id() . '-' . $order->get_total(),
                    'User-Agent'      => 'PayNOC-WooCommerce/' . PAYNOC_WC_VERSION,
                ],
                'body' => wp_json_encode($payload),
            ]);

            if (is_wp_error($response)) {
                wc_add_notice(__('PayNOC connection error: ', 'paynoc') . $response->get_error_message(), 'error');
                return ['result' => 'failure'];
            }
            $code = wp_remote_retrieve_response_code($response);
            $raw  = json_decode(wp_remote_retrieve_body($response), true);
            // API returns { data: { id, checkout_url, ... } }; tolerate both shapes.
            $body = isset($raw['data']) && is_array($raw['data']) ? $raw['data'] : (is_array($raw) ? $raw : []);
            if ($code < 200 || $code >= 300 || empty($body['checkout_url'])) {
                wc_add_notice(__('PayNOC did not return a checkout URL.', 'paynoc'), 'error');
                return ['result' => 'failure'];
            }

            $order->update_meta_data('_paynoc_invoice_id', (string)($body['id'] ?? ''));
            $order->update_status('pending', __('Awaiting PayNOC payment.', 'paynoc'));
            $order->save();

            return [
                'result'   => 'success',
                'redirect' => esc_url_raw((string)$body['checkout_url']),
            ];
        }

        public function process_refund($order_id, $amount = null, $reason = '') {
            $order = wc_get_order($order_id);
            if (!$order) return false;
            $invoiceId = $order->get_meta('_paynoc_invoice_id');
            if (!$invoiceId) return new WP_Error('paynoc_no_invoice', __('No PayNOC invoice on this order.', 'paynoc'));

            $response = wp_remote_post($this->api_base . '/api/public/v1/refunds', [
                'timeout' => 20,
                'headers' => [
                    'Authorization'   => 'Bearer ' . $this->api_key,
                    'Content-Type'    => 'application/json',
                    'Idempotency-Key' => 'wc-refund-' . $order_id . '-' . $amount,
                ],
                'body' => wp_json_encode([
                    'invoice_id' => $invoiceId,
                    'amount'     => (float)$amount,
                    'reason'     => $reason ?: 'WooCommerce admin refund',
                ]),
            ]);
            if (is_wp_error($response)) return $response;
            $code = wp_remote_retrieve_response_code($response);
            if ($code < 200 || $code >= 300) {
                return new WP_Error('paynoc_refund_failed', wp_remote_retrieve_body($response));
            }
            return true;
        }
    }

    add_filter('woocommerce_payment_gateways', function ($gateways) {
        $gateways[] = 'WC_Gateway_PayNOC';
        return $gateways;
    });
}

/** REST callback endpoint used by PayNOC webhooks. */
function paynoc_wc_register_webhook_route() {
    register_rest_route('paynoc/v1', '/webhook', [
        'methods'             => 'POST',
        'callback'            => 'paynoc_wc_handle_webhook',
        'permission_callback' => '__return_true', // signed with HMAC
    ]);
}

function paynoc_wc_handle_webhook(WP_REST_Request $req) {
    if (!function_exists('wc_get_order')) {
        return new WP_REST_Response(['error' => 'WooCommerce inactive'], 503);
    }

    $settings = get_option('woocommerce_paynoc_settings', []);
    $secret   = (string)($settings['webhook_secret'] ?? '');
    if ($secret === '') return new WP_REST_Response(['error' => 'not configured'], 503);

    $raw = $req->get_body();
    $sigHeader = $req->get_header('x_paynoc_signature');
    if (!$sigHeader) return new WP_REST_Response(['error' => 'missing signature'], 401);

    $parts = [];
    foreach (explode(',', $sigHeader) as $piece) {
        $kv = explode('=', trim($piece), 2);
        if (count($kv) === 2) $parts[$kv[0]] = $kv[1];
    }
    $ts  = (int)($parts['t'] ?? 0);
    $sig = (string)($parts['v1'] ?? '');
    if ($ts <= 0 || abs(time() - $ts) > 300) {
        return new WP_REST_Response(['error' => 'stale timestamp'], 401);
    }
    $expected = hash_hmac('sha256', $ts . '.' . $raw, $secret);
    if (!hash_equals($expected, $sig)) {
        return new WP_REST_Response(['error' => 'bad signature'], 401);
    }

    $payload = json_decode($raw, true);
    $event   = (string)($payload['event'] ?? '');
    $data    = $payload['data'] ?? [];
    $ref     = (string)($data['reference'] ?? '');
    $orderId = 0;
    if (strpos($ref, 'wc:') === 0) $orderId = (int)substr($ref, 3);
    if (!$orderId) $orderId = (int)($data['metadata']['order_id'] ?? 0);
    if (!$orderId) return new WP_REST_Response(['ok' => true, 'note' => 'no order ref'], 200);

    $order = wc_get_order($orderId);
    if (!$order) return new WP_REST_Response(['ok' => true, 'note' => 'order missing'], 200);

    if ($event === 'invoice.completed' && !$order->is_paid()) {
        $order->payment_complete((string)($data['id'] ?? ''));
        $order->add_order_note(sprintf(
            __('PayNOC payment received. Invoice %s.', 'paynoc'),
            (string)($data['invoice_number'] ?? $data['id'] ?? '')
        ));
    } elseif ($event === 'invoice.refunded') {
        $order->add_order_note(__('PayNOC reports a refund on this invoice.', 'paynoc'));
    } elseif ($event === 'invoice.failed' || $event === 'invoice.cancelled') {
        if ($order->get_status() === 'pending') {
            $order->update_status('failed', __('PayNOC reports the payment failed/cancelled.', 'paynoc'));
        }
    }

    return new WP_REST_Response(['ok' => true], 200);
}
