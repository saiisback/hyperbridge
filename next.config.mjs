/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'viem',
      'viem/chains',
      'wagmi',
      '@privy-io/react-auth',
      '@privy-io/wagmi',
      '@tanstack/react-query',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },
  webpack: (config) => {
    // Stub out optional wallet connector dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      '@coinbase/wallet-sdk': false,
      '@gemini-wallet/core': false,
      'porto': false,
      'porto/internal': false,
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto/internal': false,
    }
    return config
  },
}

export default nextConfig
