import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { fetchUnreadBankEmails, markAsRead } from '@/lib/gmail'
import { parseBankCreditEmail } from '@/lib/bank-email-parser'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { getDepositLockDate } from '@/lib/wallet-utils'
import { payFirstDepositReferralCommissions } from '@/lib/referral-commission'

function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !authHeader) return false
  const expected = `Bearer ${cronSecret}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!verifyCronSecret(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const senderFilter = process.env.BANK_EMAIL_SENDER || ''
    if (!senderFilter) {
      return NextResponse.json({ error: 'BANK_EMAIL_SENDER not configured' }, { status: 500 })
    }

    // Fetch unread bank emails
    const emails = await fetchUnreadBankEmails(senderFilter)

    if (emails.length === 0) {
      return NextResponse.json({ message: 'No new bank emails', processed: 0 })
    }

    // Fetch USDT/INR rate once for all approvals in this batch
    let priceData: { inrPrice: number; fetchedAt: string } | null = null

    const results: { emailId: string; status: string; remarkCode?: string; amount?: number }[] = []

    for (const email of emails) {
      try {
        const parsed = parseBankCreditEmail(email.body || email.snippet)

        if (!parsed) {
          await markAsRead(email.id)
          results.push({ emailId: email.id, status: 'skipped_not_credit' })
          continue
        }

        if (!parsed.remarkCode) {
          await markAsRead(email.id)
          results.push({ emailId: email.id, status: 'skipped_no_remark', amount: parsed.amount })
          continue
        }

        // Find pending INR deposit matching this remark code
        const transaction = await prisma.transaction.findFirst({
          where: {
            type: 'deposit',
            token: 'INR',
            status: 'pending',
            dedupKey: `inr-remark:${parsed.remarkCode}`,
          },
        })

        if (!transaction) {
          await markAsRead(email.id)
          results.push({
            emailId: email.id,
            status: 'skipped_no_match',
            remarkCode: parsed.remarkCode,
            amount: parsed.amount,
          })
          continue
        }

        const expectedAmount = Number(transaction.amountInr ?? 0)

        // Verify amount matches (allow 1% tolerance for bank rounding)
        const tolerance = expectedAmount * 0.01
        if (Math.abs(parsed.amount - expectedAmount) > tolerance) {
          await markAsRead(email.id)
          results.push({
            emailId: email.id,
            status: 'skipped_amount_mismatch',
            remarkCode: parsed.remarkCode,
            amount: parsed.amount,
          })
          continue
        }

        // Fetch price if not yet fetched
        if (!priceData) {
          priceData = await getTokenPriceInINR('USDT')
        }

        const amountInr = expectedAmount
        const usdtAmount = amountInr / priceData.inrPrice
        const lockedUntil = getDepositLockDate()
        const metadata = transaction.metadata as Record<string, unknown> | null

        // Auto-approve via atomic transaction
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.transaction.updateMany({
            where: { id: transaction.id, status: 'pending' },
            data: {
              status: 'completed',
              amount: usdtAmount,
              conversionRate: priceData!.inrPrice,
              metadata: {
                ...metadata,
                priceFetchedAt: priceData!.fetchedAt,
                lockedUntil: lockedUntil.toISOString(),
                approvedAt: new Date().toISOString(),
                approvedBy: 'auto_email',
                bankEmailAmount: parsed.amount,
              },
            },
          })

          if (claimed.count === 0) return // Already processed

          await tx.profile.update({
            where: { userId: transaction.userId },
            data: {
              totalBalance: { increment: amountInr },
              totalInvested: { increment: amountInr },
            },
          })

          await payFirstDepositReferralCommissions(tx, transaction.userId, amountInr, transaction.id)
        })

        await markAsRead(email.id)
        results.push({
          emailId: email.id,
          status: 'approved',
          remarkCode: parsed.remarkCode,
          amount: parsed.amount,
        })
      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError)
        results.push({ emailId: email.id, status: 'error' })
      }
    }

    const approved = results.filter((r) => r.status === 'approved').length

    return NextResponse.json({
      message: `Processed ${emails.length} emails, auto-approved ${approved} deposits`,
      processed: emails.length,
      approved,
      results,
    })
  } catch (error) {
    console.error('Bank email cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
