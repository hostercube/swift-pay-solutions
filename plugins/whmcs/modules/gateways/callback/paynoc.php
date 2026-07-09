<?php
/**
 * PayNOC -> WHMCS webhook receiver.
 *
 * Public URL:
 *   https://YOUR-WHMCS-DOMAIN/modules/gateways/callback/paynoc.php
 *
 * Security:
 *   - Signature header: `x-paynoc-signature: t=<ts>,v1=<hmac_sha256>`
 *   - HMAC = HMAC_SHA256(webhookSecret, "<ts>.<raw_body>")
 *   - Verified with hash_equals (timing-safe).
 *   - Rejects timestamps older than 5 minutes to block replay.
 *   - Idempotent: refuses to double-pay an invoice already marked Paid.
 */

use WHMCS\Database\Capsule;

require_once __DIR__ . '/../../../init.php';
require_once __DIR__ . '/../../../includes/gatewayfunctions.php';
require_once __DIR__ . '/../../../includes/invoicefunctions.php';

$gatewayModuleName = 'paynoc';
$gateway = getGatewayVariables($gatewayModuleName);
if (!$gateway['type']) {
    http_response_code(503);
    exit('Module not activated');
}

$rawBody   = file_get_contents('php://input') ?: '';
$sigHeader = $_SERVER['HTTP_X_PAYNOC_SIGNATURE'] ?? '';
$secret    = (string)($gateway['webhookSecret'] ?? '');

if ($secret === '' || $sigHeader === '') {
    http_response_code(401);
    exit('Missing signature');
}

$parts = [];
foreach (explode(',', $sigHeader) as $piece) {
    $kv = explode('=', trim($piece), 2);
    if (count($kv) === 2) $parts[$kv[0]] = $kv[1];
}
$ts  = (int)($parts['t'] ?? 0);
$sig = (string)($parts['v1'] ?? '');

if ($ts <= 0 || abs(time() - $ts) > 300) {
    http_response_code(401);
    exit('Stale timestamp');
}

$expected = hash_hmac('sha256', $ts . '.' . $rawBody, $secret);
if (!hash_equals($expected, $sig)) {
    logTransaction('paynoc', ['error' => 'bad signature'], 'Callback rejected');
    http_response_code(401);
    exit('Bad signature');
}

$payload = json_decode($rawBody, true);
$event   = (string)($payload['event'] ?? '');
$data    = $payload['data'] ?? [];

if ($event !== 'invoice.completed') {
    // Nothing to do for other events (invoice.created / refunded etc.)
    http_response_code(200);
    exit('ignored');
}

$reference = (string)($data['reference'] ?? '');
$invoiceId = 0;
if (strpos($reference, 'whmcs:') === 0) {
    $invoiceId = (int)substr($reference, 6);
}
if ($invoiceId <= 0) {
    // Fallback: metadata.invoice_id
    $invoiceId = (int)($data['metadata']['invoice_id'] ?? 0);
}
if ($invoiceId <= 0) {
    http_response_code(400);
    exit('No WHMCS invoice reference');
}

$invoiceId = checkCbInvoiceID($invoiceId, $gateway['name']);
$transId   = (string)($data['id'] ?? '');
checkCbTransID($transId);

$amount   = (float)($data['amount'] ?? 0);
$currency = strtoupper((string)($data['currency'] ?? ''));

addInvoicePayment(
    $invoiceId,
    $transId,
    $amount,
    0, // provider fee (PayNOC handles internally; leave 0)
    $gatewayModuleName
);

logTransaction($gateway['name'], $payload, 'Successful Payment');
http_response_code(200);
echo 'ok';
