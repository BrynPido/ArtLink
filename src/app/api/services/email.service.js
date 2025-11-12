// Migrated from Nodemailer to Resend
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.lastInitError = null;
    this.initializationPromise = this.initializeClient();
  }

  /**
   * Initialize email transporter based on environment variables
   */
  async initializeClient() {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ RESEND_API_KEY not set. Email sending disabled.');
        this.lastInitError = 'RESEND_API_KEY not set';
        return;
      }
      this.client = new Resend(apiKey);
      this.isInitialized = true;
      this.lastInitError = null;
      console.log('✅ Resend email client initialized');
    } catch (error) {
      console.error('❌ Resend initialization failed:', error.message);
      this.lastInitError = error.message;
    }
  }

  /**
   * Send OTP email for registration
   * @param {string} email - Recipient email
   * @param {string} otpCode - 6-digit OTP code
   * @param {string} userName - User's name
   */
  async sendRegistrationOTP(email, otpCode, userName = '') {
  // For development: Always log OTP to console (keep existing behavior)
  console.log(`🔐 [DEV] OTP for ${email}: ${otpCode}`);
    
    const subject = 'Welcome to ArtLink - Verify Your Email';
    const html = this.generateRegistrationOTPTemplate(otpCode, userName);
    
    const result = await this.sendEmail(email, subject, html);
    
    // If email fails in development, still return success with console log
    if (!result.success && process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Email send failed, but OTP logged above: ${otpCode}`);
      return {
        success: true,
        messageId: 'dev-console-log',
        devMode: true
      };
    }
    
    return result;
  }

  /**
   * Send OTP email for password reset
   * @param {string} email - Recipient email
   * @param {string} otpCode - 6-digit OTP code
   * @param {string} userName - User's name
   */
  async sendPasswordResetOTP(email, otpCode, userName = '') {
    const subject = 'ArtLink - Reset Your Password';
    const html = this.generatePasswordResetOTPTemplate(otpCode, userName);
    
    return await this.sendEmail(email, subject, html);
  }

  /**
   * Notify user account archived (soft delete)
   * @param {string} email - Recipient email
   * @param {string} userName - User name
   * @param {string} reason - Archival reason
   */
  async sendAccountArchivedEmail(email, userName = '', reason = '') {
    const subject = 'Your ArtLink Account Has Been Archived';
    const html = this.generateAccountArchivedTemplate(userName, reason);
    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send generic email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   */
  async sendEmail(to, subject, html) {
    try {
      if (!this.isInitialized || !this.client) {
        if (this.initializationPromise) {
          await this.initializationPromise.catch(() => {});
        }
      }

      if (!this.isInitialized || !this.client) {
        console.log('📧 Resend client not configured, cannot send email:', { to, subject });
        return { success: false, error: 'Email service not configured' };
      }

      const fromAddress = process.env.RESEND_FROM;
      if (!fromAddress) {
        console.error('❌ RESEND_FROM not set. Set a verified sender like "ArtLink <noreply@your-domain.com>"');
        return { success: false, error: 'RESEND_FROM not configured' };
      }

      console.log('📤 Sending email via Resend:', { to, subject, from: fromAddress });

      const { data, error } = await this.client.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html
      });

      if (error) {
        console.error('❌ Failed to send email via Resend:', error?.message || error);
        return { success: false, error: error?.message || 'Unknown Resend error' };
      }

      console.log(`✅ Email sent successfully to ${to}:`, data && data.id);
      return { success: true, messageId: data && data.id };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Explicit transporter guard that routes could optionally call
   */
  async ensureTransporter() {
    if (!this.isInitialized || !this.client) {
      if (this.initializationPromise) {
        await this.initializationPromise.catch(() => {});
      }
      if (!this.isInitialized || !this.client) {
        await this.initializeClient();
      }
    }
    return !!this.client;
  }

  /**
   * Generate HTML template for registration OTP
   */
  generateRegistrationOTPTemplate(otpCode, userName) {
    const greeting = userName ? `Hi ${userName},` : 'Hello,';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - ArtLink</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px; }
        .otp-box { background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 0; font-family: monospace; }
        .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎨 Welcome to ArtLink!</h1>
          <p>We're excited to have you join our creative community</p>
        </div>
        
        <div class="content">
          <p>${greeting}</p>
          
          <p>Thank you for joining ArtLink! To complete your registration and start connecting with fellow artists, please verify your email address using the verification code below:</p>
          
          <div class="otp-box">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: 500;">Verification Code</p>
            <p class="otp-code">${otpCode}</p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>Important:</strong></p>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>This code will expire in <strong>10 minutes</strong></li>
              <li>Use this code only on the ArtLink website</li>
              <li>Don't share this code with anyone</li>
            </ul>
          </div>
          
          <p>If you didn't create an account with ArtLink, you can safely ignore this email.</p>
          
          <p>Welcome to the community!<br>
          The ArtLink Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please don't reply to this message.</p>
          <p>© 2024 ArtLink. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  /**
   * Generate HTML template for password reset OTP
   */
  generatePasswordResetOTPTemplate(otpCode, userName) {
    const greeting = userName ? `Hi ${userName},` : 'Hello,';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - ArtLink</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px; }
        .otp-box { background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 8px; margin: 0; font-family: monospace; }
        .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
          <p>Reset your ArtLink account password</p>
        </div>
        
        <div class="content">
          <p>${greeting}</p>
          
          <p>We received a request to reset your ArtLink account password. Use the verification code below to proceed with the password reset:</p>
          
          <div class="otp-box">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; text-transform: uppercase; font-weight: 500;">Password Reset Code</p>
            <p class="otp-code">${otpCode}</p>
          </div>
          
          <div class="warning-box">
            <p style="margin: 0;"><strong>Security Notice:</strong></p>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>This code expires in <strong>10 minutes</strong></li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Never share this code with anyone</li>
            </ul>
          </div>
          
          <p>If you didn't request a password reset, your account is still secure and no action is needed.</p>
          
          <p>Stay secure,<br>
          The ArtLink Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please don't reply to this message.</p>
          <p>© 2024 ArtLink. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  /**
   * Generate HTML template for account archived notification
   */
  generateAccountArchivedTemplate(userName, reason) {
    const greeting = userName ? `Hi ${userName},` : 'Hello,';
    const reasonHtml = reason ? `<p style="margin:0 0 12px 0"><strong>Reason provided:</strong> ${reason}</p>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Archived - ArtLink</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#374151;margin:0;padding:0;background:#f3f4f6}.container{max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden}.header{background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;padding:28px;text-align:center}.header h1{margin:0;font-size:22px;font-weight:600}.content{padding:32px}.badge{display:inline-block;background:#FEF3C7;color:#92400E;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;letter-spacing:.5px;margin-bottom:20px;text-transform:uppercase}.panel{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:18px;margin:22px 0}.footer{background:#f9fafb;padding:24px;text-align:center;color:#6b7280;font-size:13px}.button{display:inline-block;background:#D97706;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:12px}</style></head><body><div class="container"><div class="header"><h1>Account Archived</h1><p style="margin-top:6px;font-size:14px;opacity:.9">Your presence on ArtLink is temporarily inactive</p></div><div class="content"><span class="badge">STATUS: ARCHIVED</span><p>${greeting}</p><p>Your ArtLink account has been <strong>archived</strong> by an administrator. While archived, your profile and associated content will not be publicly visible. Most data is retained internally for a period of up to <strong>60 days</strong>.</p>${reasonHtml}<div class="panel"><p style="margin:0 0 10px 0;font-weight:600;color:#92400E">What does this mean?</p><ul style="margin:0 0 0 18px;padding:0;color:#6b7280;font-size:14px"><li>Your profile is hidden from public view.</li><li>Posts and listings are retained but may be inaccessible.</li><li>You may request restoration within 60 days.</li><li>After 60 days the account may be permanently purged.</li></ul></div><p>If you believe this action was a mistake or want to restore your account, please reply to this email or contact support through the help center.</p><p>Regards,<br>The ArtLink Team</p></div><div class="footer"><p>This is an automated message – please do not reply directly.</p><p>© ${new Date().getFullYear()} ArtLink. All rights reserved.</p></div></div></body></html>`;
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration() {
    if (!this.isInitialized || !this.client) {
      return { success: false, error: 'Resend client not initialized' };
    }
    // Resend has no verify call; we can perform a lightweight noop by attempting a validation of API key presence
    return { success: true, message: 'Resend client initialized (API key present)' };
  }

  /**
   * Return current email service status for health checks
   */
  getStatus() {
    return {
      initialized: !!this.isInitialized,
      hasClient: !!this.client,
      hasApiKey: !!process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM || null,
      lastInitError: this.lastInitError || null
    };
  }
}

module.exports = new EmailService();