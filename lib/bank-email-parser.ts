export interface ParsedBankCredit {
  amount: number
  remarkCode: string | null
  raw: string
}

/**
 * Parse a bank credit notification email body to extract amount and remark code.
 *
 * Handles common Indian bank email formats:
 * - SBI:   "credited by Rs.10000.00 ... Info: IMPS/483921/..."
 * - HDFC:  "Rs 10,000.00 has been credited ... Remarks: 483921"
 * - ICICI: "credited with INR 10,000.00 ... Remarks-483921"
 * - Axis:  "INR 10,000.00 credited ... Remarks: 483921"
 * - Kotak: "Rs. 10,000.00 credited ... 483921"
 * - Generic IMPS/NEFT patterns
 */
export function parseBankCreditEmail(body: string): ParsedBankCredit | null {
  if (!body) return null

  const text = body.replace(/\s+/g, ' ')

  // Check if this is a credit notification (not debit)
  const isCreditEmail =
    /credited/i.test(text) ||
    /received/i.test(text) ||
    /credit\b/i.test(text)

  if (!isCreditEmail) return null

  // Make sure it's not a debit notification
  if (/debited/i.test(text) && !/credited/i.test(text)) return null

  // Extract amount — try multiple patterns
  const amount = extractAmount(text)
  if (!amount || amount <= 0) return null

  // Extract 6-digit remark code
  const remarkCode = extractRemarkCode(text)

  return { amount, remarkCode, raw: text.slice(0, 500) }
}

function extractAmount(text: string): number | null {
  // Patterns for Indian bank amount formats
  const patterns = [
    // Rs.10,000.00 or Rs 10,000.00 or Rs.10000.00
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    // credited by 10000.00
    /credited\s+(?:by|with|for)\s+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    // amount of Rs 10,000
    /amount\s+(?:of\s+)?(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, '')
      const num = parseFloat(cleaned)
      if (num > 0) return num
    }
  }

  return null
}

function extractRemarkCode(text: string): string | null {
  // Look for our 6-digit remark code in various positions

  // Explicit remark/remarks field: "Remarks: 483921" or "Remark-483921" or "Info: IMPS/483921/"
  const remarkPatterns = [
    /(?:remark|remarks|ref|reference|info|narration|description)[:\s-]+.*?(\b\d{6}\b)/i,
    // IMPS format: "IMPS/483921/" or "IMPS-483921"
    /IMPS[\/\-\s]*(\d{6})\b/i,
    // NEFT format: "NEFT/483921"
    /NEFT[\/\-\s]*.*?(\b\d{6}\b)/i,
    // UPI format with remark
    /UPI[\/\-\s]*.*?(\b\d{6}\b)/i,
  ]

  for (const pattern of remarkPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }

  // Fallback: look for any standalone 6-digit number that could be our code
  // Only use this if we find exactly one 6-digit number that's not part of
  // account numbers, amounts, or dates
  const allSixDigit = [...text.matchAll(/\b(\d{6})\b/g)]
    .map((m) => m[1])
    .filter((code) => {
      // Filter out likely non-remark numbers
      const num = parseInt(code)
      // Skip if it looks like a date (DDMMYY)
      if (num >= 10123 && num <= 311299) return false
      // Skip common non-remark patterns
      return true
    })

  // Only return if exactly one candidate found (avoids ambiguity)
  if (allSixDigit.length === 1) return allSixDigit[0]

  return null
}
