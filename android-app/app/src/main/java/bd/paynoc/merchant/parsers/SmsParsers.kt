package bd.paynoc.merchant.parsers

/**
 * Regex-based SMS parsers for common Bangladesh payment providers, including
 * Bangla QR (Bangladesh Bank unified QR) notifications from banks and MFS.
 *
 * Each parser must expose named regex groups: `trxId`, `amount`, and
 * optionally `sender` (the payer number / masked card). Parsers are tried in
 * order; the first match wins. Order matters: put provider-specific templates
 * before the generic bank credit fallback so a bKash / Nagad SMS is not
 * classified as `bank`.
 */
data class ParsedSms(
    val provider: String,
    val trxId: String,
    val amount: Double,
    val sender: String?,
    val rawBody: String,
)

private data class Parser(
    val provider: String,
    val senderIds: List<String>,
    val regex: Regex,
)

private val PARSERS = listOf(
    // ── bKash Merchant / Personal receive ───────────────────────────────
    // "You have received Tk 500.00 from 017XXXXXXXX. ... TrxID ABC123XYZ"
    Parser(
        provider = "bkash",
        senderIds = listOf("bKash", "16247"),
        regex = Regex(
            """received\s+Tk\s+(?<amount>[\d,]+\.?\d*)\s+from\s+(?<sender>\d+).*?TrxID\s+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    // bKash QR-Pay merchant SMS: "QR Payment received Tk 500.00 ... TrxID ..."
    Parser(
        provider = "bangla_qr",
        senderIds = listOf("bKash", "16247"),
        regex = Regex(
            """QR\s*Pay(?:ment)?\s*(?:received|credited)?\s*(?:Tk|BDT)\s*(?<amount>[\d,]+\.?\d*).*?(?:from\s+(?<sender>\d+).*?)?TrxID\s+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),

    // ── Nagad ───────────────────────────────────────────────────────────
    Parser(
        provider = "nagad",
        senderIds = listOf("NAGAD", "16167"),
        regex = Regex(
            """Amount:\s*Tk\s*(?<amount>[\d,]+\.?\d*).*?Sender:\s*(?<sender>\d+).*?TxnId:\s*(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    Parser(
        provider = "bangla_qr",
        senderIds = listOf("NAGAD", "16167"),
        regex = Regex(
            """QR\s*(?:Payment|Pay)\s*Received.*?Tk\s*(?<amount>[\d,]+\.?\d*).*?TxnId:?\s*(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),

    // ── Rocket / DBBL ───────────────────────────────────────────────────
    Parser(
        provider = "rocket",
        senderIds = listOf("DBBL", "16216", "ROCKET"),
        regex = Regex(
            """Cash\s+In\s+Tk\s+(?<amount>[\d,]+\.?\d*)\s+from\s+(?<sender>\d+).*?TxnID\s+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    // DBBL Nexus / Bangla QR: "QR sale BDT 500.00 ... Ref XXXX"
    Parser(
        provider = "bangla_qr",
        senderIds = listOf("DBBL", "16216", "NEXUSPAY"),
        regex = Regex(
            """QR\s+(?:sale|payment|credit).*?BDT\s+(?<amount>[\d,]+\.?\d*).*?(?:Ref|TxnID)[:\s]+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),

    // ── Generic Bangla QR (any bank) ────────────────────────────────────
    // Covers City Bank Citytouch, EBL Skypay, MTB Smart, BRAC Astha, Bank
    // Asia, IFIC Aamar, IBBL mCash, Standard Chartered Straight2Bank etc.
    // Example: "Bangla QR: BDT 500.00 credited to A/C ****1234. TrxID/Ref: 8A7BXY"
    Parser(
        provider = "bangla_qr",
        senderIds = emptyList(),
        regex = Regex(
            """(?:Bangla\s*QR|BanglaQR|QR\s*Pay(?:ment)?)[^\n]*?(?:BDT|Tk)\s*(?<amount>[\d,]+\.?\d*)[^\n]*?(?:TrxID|Txn(?:ID)?|Ref)[:\s]+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),

    // ── Generic bank credit (must stay last) ────────────────────────────
    Parser(
        provider = "bank",
        senderIds = emptyList(),
        regex = Regex(
            """BDT\s+(?<amount>[\d,]+\.?\d*)\s+credited.*?Ref[:\s]+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
)

object SmsParsers {
    fun parse(sender: String, body: String): ParsedSms? {
        for (p in PARSERS) {
            val senderOk = p.senderIds.isEmpty() ||
                p.senderIds.any { sender.contains(it, ignoreCase = true) }
            if (!senderOk) continue
            val m = p.regex.find(body) ?: continue
            val amount = m.groups["amount"]?.value?.replace(",", "")?.toDoubleOrNull() ?: continue
            val trxId = m.groups["trxId"]?.value ?: continue
            val payer = runCatching { m.groups["sender"]?.value }.getOrNull()
            return ParsedSms(
                provider = p.provider,
                trxId = trxId,
                amount = amount,
                sender = payer,
                rawBody = body,
            )
        }
        return null
    }
}
