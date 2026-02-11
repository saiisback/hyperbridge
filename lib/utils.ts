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
