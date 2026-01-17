-- Migration: Add post review system columns
-- Description: Adds review status, reviewer tracking, and decline reason to posts table
-- Date: 2026-01-18

-- Add review status column with default 'pending' for new posts
ALTER TABLE post 
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending' NOT NULL;

-- Add reviewed_by column to track which admin reviewed the post
ALTER TABLE post
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;

-- Add reviewed_at column to track when the review happened
ALTER TABLE post
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Add decline_reason column for admin feedback when declining posts
ALTER TABLE post
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Add foreign key constraint for reviewed_by
ALTER TABLE post
ADD CONSTRAINT post_reviewed_by_fkey 
FOREIGN KEY (reviewed_by) REFERENCES "user"(id);

-- Create index on review_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_post_review_status ON post(review_status);

-- Create index on reviewed_at for sorting
CREATE INDEX IF NOT EXISTS idx_post_reviewed_at ON post(reviewed_at);

-- Update existing posts to 'approved' status (backward compatibility)
-- This ensures all existing posts remain visible
UPDATE post 
SET review_status = 'approved' 
WHERE review_status = 'pending' AND "deletedAt" IS NULL;

-- Add check constraint to ensure valid review statuses
ALTER TABLE post
ADD CONSTRAINT post_review_status_check 
CHECK (review_status IN ('pending', 'approved', 'declined'));

-- Log the migration
COMMENT ON COLUMN post.review_status IS 'Post review status: pending (awaiting review), approved (visible to public), declined (rejected by admin)';
COMMENT ON COLUMN post.reviewed_by IS 'User ID of admin who reviewed the post';
COMMENT ON COLUMN post.reviewed_at IS 'Timestamp when the post was reviewed';
COMMENT ON COLUMN post.decline_reason IS 'Admin feedback explaining why the post was declined';
