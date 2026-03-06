export function getPlatformBankDetails() {
  return {
    bankName: process.env.PLATFORM_BANK_NAME || '',
    accountNumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || '',
    ifsc: process.env.PLATFORM_BANK_IFSC || '',
    accountHolder: process.env.PLATFORM_BANK_ACCOUNT_HOLDER || '',
    upiId: process.env.PLATFORM_BANK_UPI_ID || '',
  }
}
