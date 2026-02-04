-- HyperBridge Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Privy)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  privy_id TEXT UNIQUE NOT NULL,

  -- Profile Info
  name TEXT,
  avatar_url TEXT,

  -- Auth Methods (from Privy, for reference/querying)
  email TEXT UNIQUE,
  primary_wallet TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  kyc_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- User wallets (one-to-many relationship)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  wallet_address TEXT NOT NULL,
  chain_type TEXT DEFAULT 'ethereum',
  wallet_client TEXT,
  is_primary BOOLEAN DEFAULT false,

  linked_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(wallet_address)
);

-- Profiles table (extended user data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Financial
  total_balance DECIMAL(18,8) DEFAULT 0,
  available_balance DECIMAL(18,8) DEFAULT 0,
  total_invested DECIMAL(18,8) DEFAULT 0,

  -- Referral
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES users(id),

  -- Settings
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'roi', 'referral')),
  amount DECIMAL(18,8) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),

  tx_hash TEXT,
  wallet_address TEXT,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals (3-level MLM)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES users(id),
  referee_id UUID REFERENCES users(id),
  level INTEGER CHECK (level IN (1, 2, 3)),

  total_earnings DECIMAL(18,8) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(referrer_id, referee_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_privy_id ON users(privy_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(primary_wallet);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Note: For the API route, we use the service role key which bypasses RLS
-- These policies are for direct client access if needed in the future

-- Public read policy for users (for referral lookups)
CREATE POLICY "Public can view basic user info" ON users
  FOR SELECT
  USING (true);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (privy_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Wallet policies
CREATE POLICY "Users can view own wallets" ON user_wallets
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Profile policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (user_id IN (
    SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Transaction policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Referral policies
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT
  USING (
    referrer_id IN (SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub')
    OR
    referee_id IN (SELECT id FROM users WHERE privy_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
