// Map our token symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  USDT: 'tether',
}

interface PriceResult {
  inrPrice: number
  token: string
  fetchedAt: string
}

/**
 * Fetch the real-time INR price of a crypto token from CoinGecko.
 * Returns the price of 1 unit of the token in INR.
 */
export async function getTokenPriceInINR(token: string): Promise<PriceResult> {
  const coinId = COINGECKO_IDS[token]
  if (!coinId) {
    throw new Error(`Unsupported token: ${token}`)
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=inr`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 }, // no cache — always fetch fresh price
  })

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const inrPrice = data[coinId]?.inr

  if (typeof inrPrice !== 'number') {
    throw new Error(`Could not get INR price for ${token}`)
  }

  return {
    inrPrice,
    token,
    fetchedAt: new Date().toISOString(),
  }
}
