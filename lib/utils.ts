import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format an INR value as a display string (e.g. "8,500.00") */
export function formatINR(inr: number): string {
  if (inr === 0) return '0.00'
  if (inr < 1 && inr > 0) return inr.toFixed(4)
  return inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Truncate a wallet address for display (e.g. "0x1234...abcd") */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/** Truncate a transaction hash for display */
export function truncateHash(hash: string | null): string {
  if (!hash) return '-'
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

/** Format a date string to a localized string */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

/** Format a date to a human-readable "time ago" string */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Format an activity type to a human-readable description */
export function formatActivityDescription(type: string): string {
  switch (type) {
    case 'deposit': return 'Deposit received'
    case 'roi': return 'Daily ROI credited'
    case 'referral': return 'Referral bonus'
    case 'withdraw': return 'Withdrawal processed'
    default: return type
  }
}

/** Get the wallet client display name */
export function getWalletClientName(client: string | undefined): string {
  if (!client) return 'Unknown'
  if (client.includes('metamask')) return 'MetaMask'
  if (client.includes('walletconnect')) return 'WalletConnect'
  if (client.includes('coinbase')) return 'Coinbase'
  if (client.includes('rainbow')) return 'Rainbow'
  if (client.includes('privy')) return 'Embedded Wallet'
  return client
}

/** Format a date for profile display */
export function formatProfileDate(date: string | Date | null): string {
  if (!date) return 'N/A'
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
