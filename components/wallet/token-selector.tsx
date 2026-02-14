'use client'

const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS as `0x${string}`

const TOKENS = {
  ETH: { name: 'ETH', address: null as null, decimals: 18 },
  USDT: { name: 'USDT', address: USDT_ADDRESS, decimals: 6 },
} as const

export type TokenKey = keyof typeof TOKENS

export { TOKENS }

interface TokenSelectorProps {
  selectedToken: TokenKey
  onSelectToken: (token: TokenKey) => void
}

export function TokenSelector({ selectedToken, onSelectToken }: TokenSelectorProps) {
  return (
    <div className="flex gap-2">
      {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
        <button
          key={key}
          onClick={() => onSelectToken(key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedToken === key
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
          }`}
        >
          {TOKENS[key].name}
        </button>
      ))}
    </div>
  )
}
