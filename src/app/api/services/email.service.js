const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment variables
   */
  async initializeTransporter() {
    try {
      // Configure based on email provider
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
      
      if (emailProvider === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD // Use App Password for Gmail
          }
        });
      } else if (emailProvider === 'sendgrid') {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else {
        // Default SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }

      // Verify transporter configuration
      if (this.transporter) {
        await this.transporter.verify();
        console.log('✅ Email service initialized successfully');
      }
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      // Don't throw error, allow app to continue without email
    }
  }

  /**
   * Send OTP email for registration
   * @param {string} email - Recipient email
   * @param {string} otpCode - 6-digit OTP code
   * @param {string} userName - User's name
   */
  async sendRegistrationOTP(email, otpCode, userName = '') {
    // For development: Always log OTP to console
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
   * Send generic email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   */
  async sendEmail(to, subject, html) {
    try {
      if (!this.transporter) {
        console.log('📧 Email service not configured, logging OTP instead:', { to, subject });
        return {
          success: false,
          error: 'Email service not configured'
        };
      }

      const mailOptions = {
        from: {
          name: 'ArtLink',
          address: process.env.EMAIL_FROM || process.env.SMTP_USER
        },
        to,
        subject,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${to}:`, result.messageId);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
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
   * Test email configuration
   */
  async testEmailConfiguration() {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email transporter not initialized'
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email configuration is valid'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();