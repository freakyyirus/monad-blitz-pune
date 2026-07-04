-- Add winner_submission_id to bounties table
ALTER TABLE bounties 
ADD COLUMN IF NOT EXISTS winner_submission_id uuid REFERENCES submissions(id);
