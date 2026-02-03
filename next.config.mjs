/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
