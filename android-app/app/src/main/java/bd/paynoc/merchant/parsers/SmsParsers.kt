package bd.paynoc.merchant.parsers

/**
 * Regex-based SMS parsers for common Bangladesh payment providers.
 * Add a new [Parser] entry to support a new bank / MFS.
 *
 * Each parser must expose named regex groups: `trxId`, `amount`, and
 * optionally `sender` (the number that paid).
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
    // "You have received Tk 500.00 from 017XXXXXXXX. Fee Tk 0.00.
    //  Balance Tk 1,234.56. TrxID ABC123XYZ at ..."
    Parser(
        provider = "bkash",
        senderIds = listOf("bKash", "16247"),
        regex = Regex(
            """received\s+Tk\s+(?<amount>[\d,]+\.?\d*)\s+from\s+(?<sender>\d+).*?TrxID\s+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    // "Money Received. Amount: Tk 500.00, Sender: 017XXXXXXXX,
    //  TxnId: 76A2B1CD, ..."
    Parser(
        provider = "nagad",
        senderIds = listOf("NAGAD", "16167"),
        regex = Regex(
            """Amount:\s*Tk\s*(?<amount>[\d,]+\.?\d*).*?Sender:\s*(?<sender>\d+).*?TxnId:\s*(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    // "Cash In Tk 500.00 from 017XXXXXXXX. TxnID 12345678. Bal Tk ..."
    Parser(
        provider = "rocket",
        senderIds = listOf("DBBL", "16216"),
        regex = Regex(
            """Cash\s+In\s+Tk\s+(?<amount>[\d,]+\.?\d*)\s+from\s+(?<sender>\d+).*?TxnID\s+(?<trxId>[A-Z0-9]+)""",
            RegexOption.IGNORE_CASE,
        ),
    ),
    // Generic bank credit — "BDT 500.00 credited ... Ref: XYZ123"
    Parser(
        provider = "bank",
        senderIds = emptyList(), // matches by regex only
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
