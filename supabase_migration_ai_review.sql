-- Add AI review columns to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS is_ai_selected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
