-- Create listing_transaction table to track successful sales
CREATE TABLE IF NOT EXISTS listing_transaction (
  id SERIAL PRIMARY KEY,
  listingId INTEGER NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  sellerId INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  buyerId INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  conversationId INTEGER REFERENCES conversation(id) ON DELETE SET NULL,
  finalPrice DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- completed, cancelled, refunded
  notes TEXT,
  createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_listing_transaction_seller ON listing_transaction(sellerId);
CREATE INDEX IF NOT EXISTS idx_listing_transaction_buyer ON listing_transaction(buyerId);
CREATE INDEX IF NOT EXISTS idx_listing_transaction_listing ON listing_transaction(listingId);
CREATE INDEX IF NOT EXISTS idx_listing_transaction_created ON listing_transaction(createdAt);
CREATE INDEX IF NOT EXISTS idx_listing_transaction_status ON listing_transaction(status);

-- Add status column to listing table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='listing' AND column_name='status') THEN
    ALTER TABLE listing ADD COLUMN status VARCHAR(50) DEFAULT 'available';
  END IF;
END $$;

-- Create index on listing status
CREATE INDEX IF NOT EXISTS idx_listing_status ON listing(status);

COMMENT ON TABLE listing_transaction IS 'Tracks successful item sales/purchases';
COMMENT ON COLUMN listing_transaction.status IS 'Transaction status: completed, cancelled, refunded';
COMMENT ON COLUMN listing.status IS 'Listing status: available, sold, reserved, deleted';
