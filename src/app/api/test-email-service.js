// Test file to verify email service functionality
// Run this with: node test-email-service.js

require('dotenv').config();
const emailService = require('./services/email.service');

async function testEmailService() {
  console.log('🔧 Testing Email Service...');
  
  try {
    // Test email configuration
    const configTest = await emailService.testEmailConfiguration();
    console.log('📧 Email configuration test:', configTest);

    // Test OTP email if RESEND_FROM + TARGET_EMAIL provided
    const targetEmail = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_TO;
    if (targetEmail) {
      console.log('📤 Testing OTP email send via Resend...');
      const result = await emailService.sendRegistrationOTP(
        targetEmail,
        '123456',
        'Test User'
      );
      console.log('📧 Email send result:', result);
    } else {
      console.log('⚠️ TEST_EMAIL_RECIPIENT not set. Set it in .env to send a test email.');
    }

  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testEmailService();
}