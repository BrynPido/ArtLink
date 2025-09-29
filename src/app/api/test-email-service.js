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
    
    // Test OTP email (replace with your email)
    if (process.env.EMAIL_USER) {
      console.log('📤 Testing OTP email send...');
      const result = await emailService.sendRegistrationOTP(
        process.env.EMAIL_USER, 
        '123456', 
        'Test User'
      );
      console.log('📧 Email send result:', result);
    } else {
      console.log('⚠️  EMAIL_USER not configured, skipping email send test');
    }
    
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testEmailService();
}