-- Migration: Add user_id column to bounties and submissions tables
-- This allows tracking users across multiple wallets (embedded + MetaMask)

-- Add user_id to bounties
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS user_id text;

-- Add user_id to submissions  
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bounties_user_id ON bounties(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);

-- Optionally: Create a users table to store user wallet mappings
-- (This is optional but useful for future features)
CREATE TABLE IF NOT EXISTS users (
  id text primary key, -- Privy user ID (e.g., "did:privy:...")
  wallet_addresses text[] default '{}', -- Array of all wallet addresses
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be created" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be updated" ON users FOR UPDATE USING (true);
