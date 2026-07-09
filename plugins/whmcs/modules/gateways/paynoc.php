<?php
/**
 * PayNOC Payment Gateway for WHMCS
 * -----------------------------------------------------------------------------
 *  - Multi-currency: forwards the invoice currency to PayNOC as-is.
 *  - Callback URL is fixed & documented (see callback/paynoc.php).
 *  - Zero secrets in the browser; all API calls happen server-side from WHMCS.
 *  - HMAC signature verification on the callback (see callback file).
 *
 * Install: copy the whole `modules/gateways/` tree into your WHMCS root, then
 * enable "PayNOC" under Setup -> Payments -> Payment Gateways.
 *
 * Callback URL (paste into PayNOC dashboard -> Webhooks):
 *   https://YOUR-WHMCS-DOMAIN/modules/gateways/callback/paynoc.php
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

function paynoc_MetaData()
{
    return [
        'DisplayName' => 'PayNOC',
        'APIVersion'  => '1.1',
        'DisableLocalCreditCardInput' => true,
        'TokenisedStorage' => false,
    ];
}

function paynoc_config()
{
    return [
        'FriendlyName' => [
            'Type'  => 'System',
            'Value' => 'PayNOC (bKash / Nagad / Rocket / Cards)',
        ],
        'apiBaseUrl' => [
            'FriendlyName' => 'API Base URL',
            'Type'         => 'text',
            'Size'         => '60',
            'Default'      => 'https://paynoc.com',
            'Description'  => 'Your PayNOC deployment base URL (https only).',
        ],
        'apiKey' => [
            'FriendlyName' => 'API Key',
            'Type'         => 'password',
            'Size'         => '60',
            'Description'  => 'Merchant API key from PayNOC dashboard -> API Keys.',
        ],
        'webhookSecret' => [
            'FriendlyName' => 'Webhook Signing Secret',
            'Type'         => 'password',
            'Size'         => '60',
            'Description'  => 'Webhook endpoint signing secret (from PayNOC dashboard).',
        ],
        'mode' => [
            'FriendlyName' => 'Environment',
            'Type'         => 'dropdown',
            'Options'      => ['live' => 'Live', 'test' => 'Test'],
            'Default'      => 'live',
        ],
    ];
}

/**
 * Called by WHMCS when the customer clicks "Pay Now".
 * We create a PayNOC hosted invoice and redirect the customer to it.
 */
function paynoc_link($params)
{
    $apiBase = rtrim((string)($params['apiBaseUrl'] ?? ''), '/');
    $apiKey  = (string)($params['apiKey'] ?? '');
    if ($apiBase === '' || stripos($apiBase, 'https://') !== 0 || $apiKey === '') {
        return '<p style="color:#b91c1c">PayNOC is not configured. Set API Base URL (https) and API Key.</p>';
    }

    $invoiceId = (int)$params['invoiceid'];
    $amount    = (float)$params['amount'];
    $currency  = strtoupper((string)$params['currency']);
    $returnUrl = rtrim((string)$params['systemurl'], '/') . '/viewinvoice.php?id=' . $invoiceId;

    $payload = [
        'amount'         => $amount,
        'currency'       => $currency,
        'customer_name'  => trim($params['clientdetails']['firstname'] . ' ' . $params['clientdetails']['lastname']),
        'customer_email' => (string)$params['clientdetails']['email'],
        'customer_phone' => (string)($params['clientdetails']['phonenumber'] ?? ''),
        'description'    => 'WHMCS Invoice #' . $invoiceId,
        'reference'      => 'whmcs:' . $invoiceId,
        'redirect_url'   => $returnUrl,
        'metadata'       => ['source' => 'whmcs', 'invoice_id' => $invoiceId],
    ];

    $ch = curl_init($apiBase . '/api/public/v1/invoices');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
            'Idempotency-Key: whmcs-' . $invoiceId . '-' . $amount,
            'User-Agent: PayNOC-WHMCS/1.0',
        ],
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($status < 200 || $status >= 300 || !$body) {
        logTransaction('paynoc', ['status' => $status, 'error' => $err, 'body' => $body], 'Create Invoice Failed');
        return '<p style="color:#b91c1c">Unable to start PayNOC checkout. Please try again.</p>';
    }

    $data = json_decode($body, true);
    $checkoutUrl = $data['checkout_url'] ?? ($data['data']['checkout_url'] ?? null);
    if (!$checkoutUrl) {
        logTransaction('paynoc', $data, 'Missing checkout_url');
        return '<p style="color:#b91c1c">PayNOC did not return a checkout URL.</p>';
    }

    return '<a href="' . htmlspecialchars($checkoutUrl, ENT_QUOTES) . '" '
        . 'style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#f59e0b,#fbbf24);'
        . 'color:#000;font-weight:600;border-radius:10px;text-decoration:none;'
        . 'box-shadow:0 6px 18px rgba(245,158,11,.35)">Pay with PayNOC</a>';
}

/**
 * Refund an existing transaction from WHMCS admin.
 */
function paynoc_refund($params)
{
    $apiBase = rtrim((string)($params['apiBaseUrl'] ?? ''), '/');
    $apiKey  = (string)($params['apiKey'] ?? '');
    $txnId   = (string)($params['transid'] ?? '');
    $amount  = (float)$params['amount'];

    if ($apiBase === '' || $apiKey === '' || $txnId === '') {
        return ['status' => 'error', 'rawdata' => 'Missing PayNOC config or transaction id.'];
    }

    $ch = curl_init($apiBase . '/api/public/v1/refunds');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode([
            'invoice_id' => $txnId,
            'amount'     => $amount,
            'reason'     => 'WHMCS admin refund',
        ]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
            'Idempotency-Key: whmcs-refund-' . $txnId . '-' . $amount,
        ],
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 200 && $status < 300) {
        $data = json_decode($body, true);
        return [
            'status'  => 'success',
            'rawdata' => $data,
            'transid' => $data['id'] ?? $txnId,
            'fees'    => 0,
        ];
    }
    return ['status' => 'declined', 'rawdata' => $body];
}
