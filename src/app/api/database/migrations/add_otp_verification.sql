-- OTP Verification Table for ArtLink
-- Add this to your database migration

-- Create enum type for purpose
CREATE TYPE otp_purpose AS ENUM ('registration', 'password_reset', 'email_change');

CREATE TABLE email_verification (
  id SERIAL PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  purpose otp_purpose NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMP NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_email_verification_email ON email_verification(email);
CREATE INDEX idx_email_verification_otp_code ON email_verification(otp_code);
CREATE INDEX idx_email_verification_expires_at ON email_verification(expires_at);
CREATE INDEX idx_email_verification_email_purpose ON email_verification(email, purpose);

-- Add email verification status to user table
ALTER TABLE "user" ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN email_verified_at TIMESTAMP NULL;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at updates
CREATE TRIGGER update_email_verification_updated_at 
    BEFORE UPDATE ON email_verification 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired OTP records (run this as a scheduled job)
-- DELETE FROM email_verification WHERE expires_at < NOW() - INTERVAL '1 DAY';