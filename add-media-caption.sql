-- Add caption column to media table for individual image captions
ALTER TABLE media ADD COLUMN IF NOT EXISTS caption TEXT;

-- Update existing records to have empty captions
UPDATE media SET caption = '' WHERE caption IS NULL;
