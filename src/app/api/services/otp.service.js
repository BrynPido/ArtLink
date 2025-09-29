const crypto = require('crypto');
const { query, queryOne } = require('../config/database');

class OTPService {
  /**
   * Generate a 6-digit OTP code
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure random token for additional security
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create OTP record in database
   * @param {string} email - User email
   * @param {string} purpose - 'registration', 'password_reset', 'email_change'
   * @param {number} expirationMinutes - OTP expiration time in minutes (default: 10)
   */
  async createOTP(email, purpose = 'registration', expirationMinutes = 10) {
    try {
      // Clean up any existing OTP for this email and purpose
      await this.cleanupExpiredOTP(email, purpose);

      // Generate OTP code
      const otpCode = this.generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

      // Insert OTP record
      const result = await query(
        `INSERT INTO email_verification 
         (email, otp_code, purpose, expires_at, is_verified, attempts, max_attempts) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, otp_code, expires_at`,
        [email, otpCode, purpose, expiresAt, false, 0, 5]
      );

      console.log(`🔐 OTP created for ${email}: ${otpCode} (expires: ${expiresAt})`);
      
      return {
        success: true,
        otpId: result[0].id,
        otpCode: result[0].otp_code,
        expiresAt: result[0].expires_at,
        expirationMinutes
      };
    } catch (error) {
      console.error('Error creating OTP:', error);
      return {
        success: false,
        error: 'Failed to create OTP'
      };
    }
  }

  /**
   * Verify OTP code
   * @param {string} email - User email
   * @param {string} otpCode - OTP code to verify
   * @param {string} purpose - Purpose of OTP
   */
  async verifyOTP(email, otpCode, purpose = 'registration') {
    try {
      // Find valid OTP record
      const otpRecord = await queryOne(
        `SELECT id, otp_code, expires_at, is_verified, attempts, max_attempts 
         FROM email_verification 
         WHERE email = $1 AND purpose = $2 AND is_verified = FALSE 
         ORDER BY created_at DESC LIMIT 1`,
        [email, purpose]
      );

      if (!otpRecord) {
        return {
          success: false,
          error: 'No valid OTP found',
          errorCode: 'OTP_NOT_FOUND'
        };
      }

      // Check if OTP has expired
      if (new Date() > new Date(otpRecord.expires_at)) {
        await this.markOTPAsExpired(otpRecord.id);
        return {
          success: false,
          error: 'OTP has expired',
          errorCode: 'OTP_EXPIRED'
        };
      }

      // Check attempt limits
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        return {
          success: false,
          error: 'Maximum verification attempts exceeded',
          errorCode: 'MAX_ATTEMPTS_EXCEEDED'
        };
      }

      // Increment attempt count
      await query(
        'UPDATE email_verification SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [otpRecord.id]
      );

      // Verify OTP code
      if (otpRecord.otp_code !== otpCode) {
        const remainingAttempts = otpRecord.max_attempts - (otpRecord.attempts + 1);
        return {
          success: false,
          error: 'Invalid OTP code',
          errorCode: 'INVALID_OTP',
          remainingAttempts
        };
      }

      // Mark OTP as verified
      await query(
        'UPDATE email_verification SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [otpRecord.id]
      );

      console.log(`✅ OTP verified successfully for ${email}`);
      
      return {
        success: true,
        message: 'OTP verified successfully',
        otpId: otpRecord.id
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        error: 'Failed to verify OTP'
      };
    }
  }

  /**
   * Resend OTP (rate-limited)
   * @param {string} email - User email
   * @param {string} purpose - Purpose of OTP
   */
  async resendOTP(email, purpose = 'registration') {
    try {
      // Check for recent OTP requests (rate limiting)
      const recentOTP = await queryOne(
        `SELECT created_at FROM email_verification 
         WHERE email = $1 AND purpose = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [email, purpose]
      );

      if (recentOTP) {
        const timeDiff = Date.now() - new Date(recentOTP.created_at).getTime();
        const waitTime = 60000; // 1 minute wait time

        if (timeDiff < waitTime) {
          const remainingWait = Math.ceil((waitTime - timeDiff) / 1000);
          return {
            success: false,
            error: `Please wait ${remainingWait} seconds before requesting a new OTP`,
            errorCode: 'RATE_LIMITED',
            waitTime: remainingWait
          };
        }
      }

      // Create new OTP
      return await this.createOTP(email, purpose);
    } catch (error) {
      console.error('Error resending OTP:', error);
      return {
        success: false,
        error: 'Failed to resend OTP'
      };
    }
  }

  /**
   * Mark OTP as expired
   */
  async markOTPAsExpired(otpId) {
    await query(
      'UPDATE email_verification SET is_verified = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [otpId]
    );
  }

  /**
   * Clean up expired OTP records for a specific email/purpose
   */
  async cleanupExpiredOTP(email, purpose) {
    await query(
      'DELETE FROM email_verification WHERE email = $1 AND purpose = $2 AND (expires_at < CURRENT_TIMESTAMP OR is_verified = TRUE)',
      [email, purpose]
    );
  }

  /**
   * Clean up all expired OTP records (run as scheduled job)
   */
  async cleanupAllExpiredOTP() {
    const result = await query(
      'DELETE FROM email_verification WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL \'1 DAY\''
    );
    console.log(`🧹 Cleaned up ${result.rowCount} expired OTP records`);
    return result.rowCount;
  }

  /**
   * Get OTP statistics for admin monitoring
   */
  async getOTPStats() {
    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total_otp_requests,
        COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_count,
        COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_count,
        COUNT(CASE WHEN attempts >= max_attempts THEN 1 END) as max_attempts_exceeded,
        AVG(attempts) as avg_attempts
      FROM email_verification 
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 HOURS'
    `);

    return stats;
  }
}

module.exports = new OTPService();