-- Compensating store for bounties that were PAID for (x402 platform fee received
-- on Monad Testnet) but could not be inserted into `bounties` at creation time
-- (e.g. transient DB failure, missing migration in `bounties`).
--
-- The row keeps all the data so an operator can reconcile a "paid but not saved"
-- bounty by hand. Mirrors the public-read / anyone-insert dev policies used by
-- the other tables.

CREATE TABLE IF NOT EXISTS pending_bounties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  prize text NOT NULL,
  creator_address text NOT NULL,
  user_id text,
  tx_hash text NOT NULL,
  status text NOT NULL DEFAULT 'needs_attention',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_bounties_tx_hash ON pending_bounties(tx_hash);
CREATE INDEX IF NOT EXISTS idx_pending_bounties_status ON pending_bounties(status);

ALTER TABLE pending_bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pending bounties are viewable by everyone"
  ON pending_bounties FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert pending bounties"
  ON pending_bounties FOR INSERT
  WITH CHECK (true);