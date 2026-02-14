import type { PrivyClientConfig } from '@privy-io/react-auth'

export const privyConfig: PrivyClientConfig = {
  // Appearance
  appearance: {
    theme: 'dark',
    accentColor: '#f97316', // Orange to match your theme
    logo: '/icon.svg',
    showWalletLoginFirst: true,
  },

  // Login methods
  loginMethods: [
    'google',
    'wallet',
  ],

  // Embedded wallets - create wallet for email-only users
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'off',
    },
  },

  // Wallet connect config
  walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,

  // Supported chains
  supportedChains: [
    {
      id: 1,
      name: 'Ethereum',
      network: 'mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://eth.llamarpc.com'] },
        public: { http: ['https://eth.llamarpc.com'] },
      },
      blockExplorers: {
        default: { name: 'Etherscan', url: 'https://etherscan.io' },
      },
    },
    {
      id: 137,
      name: 'Polygon',
      network: 'matic',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://polygon-rpc.com'] },
        public: { http: ['https://polygon-rpc.com'] },
      },
      blockExplorers: {
        default: { name: 'PolygonScan', url: 'https://polygonscan.com' },
      },
    },
    {
      id: 8453,
      name: 'Base',
      network: 'base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://mainnet.base.org'] },
        public: { http: ['https://mainnet.base.org'] },
      },
      blockExplorers: {
        default: { name: 'BaseScan', url: 'https://basescan.org' },
      },
    },
    {
      id: 42161,
      name: 'Arbitrum One',
      network: 'arbitrum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://arb1.arbitrum.io/rpc'] },
        public: { http: ['https://arb1.arbitrum.io/rpc'] },
      },
      blockExplorers: {
        default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
      },
    },
  ],

  // Legal
  legal: {
    termsAndConditionsUrl: '/terms',
    privacyPolicyUrl: '/privacy',
  },
}
