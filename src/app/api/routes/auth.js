const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { validateRegister, validateLogin, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const otpService = require('../services/otp.service');
const emailService = require('../services/email.service');

const router = express.Router();

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRATION || '24h',
      issuer: process.env.JWT_ISSUER || 'ArtlinkAdmin'
    }
  );
};

// Register endpoint - Step 1: Create user and send OTP
router.post('/register', validateRegister, handleValidationErrors, async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT id, email_verified FROM "user" WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser) {
      // If user exists but email not verified, allow re-registration
      if (existingUser.email_verified) {
        return res.status(409).json({
          status: 'error',
          message: 'User with this email or username already exists'
        });
      } else {
        // Delete unverified user to allow re-registration
        await query('DELETE FROM "user" WHERE id = $1', [existingUser.id]);
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user with email_verified = false
    const result = await query(
      'INSERT INTO "user" (name, username, email, password, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, username, email, hashedPassword, false]
    );

    const userId = result[0].id;

    // Create user profile
    await query(
      'INSERT INTO profile ("userId", bio, "profilePictureUrl") VALUES ($1, $2, $3)',
      [userId, '', null]
    );

    // Generate and send OTP
    const otpResult = await otpService.createOTP(email, 'registration', 10);
    
    if (!otpResult.success) {
      // If OTP creation fails, still return success but log error
      console.error('Failed to create OTP:', otpResult.error);
    } else {
      // Send OTP email
      const emailResult = await emailService.sendRegistrationOTP(email, otpResult.otpCode, name);
      
      if (!emailResult.success) {
        console.error('Failed to send OTP email:', emailResult.error);
      } else {
        console.log(`✅ Registration OTP sent to ${email}`);
      }
    }

    res.status(201).json({
      status: 'success',
      message: 'Registration initiated. Please check your email for verification code.',
      payload: {
        userId: userId,
        email: email,
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register user'
    });
  }
});

// Verify OTP and complete registration
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otpCode, purpose = 'registration' } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and OTP code are required'
      });
    }

    // Verify OTP
    const otpResult = await otpService.verifyOTP(email, otpCode, purpose);

    if (!otpResult.success) {
      return res.status(400).json({
        status: 'error',
        message: otpResult.error,
        errorCode: otpResult.errorCode,
        remainingAttempts: otpResult.remainingAttempts
      });
    }

    // Find user and mark email as verified
    const user = await queryOne(
      'SELECT id, name, username, email FROM "user" WHERE email = $1',
      [email]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Mark email as verified
    await query(
      'UPDATE "user" SET email_verified = TRUE, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate token for completed registration
    const token = generateToken(user.id, user.email);

    // Get user with profile
    const verifiedUser = await queryOne(
      `SELECT u.id, u.name, u.username, u.email, u.email_verified,
              p.bio, p."profilePictureUrl"
       FROM "user" u 
       LEFT JOIN profile p ON u.id = p."userId" 
       WHERE u.id = $1`,
      [user.id]
    );

    res.json({
      status: 'success',
      message: 'Email verified successfully. Registration completed!',
      payload: {
        token,
        user: verifiedUser
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify OTP'
    });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose = 'registration' } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await queryOne(
      'SELECT id, name, email_verified FROM "user" WHERE email = $1',
      [email]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.email_verified && purpose === 'registration') {
      return res.status(400).json({
        status: 'error',
        message: 'Email is already verified'
      });
    }

    // Resend OTP
    const otpResult = await otpService.resendOTP(email, purpose);

    if (!otpResult.success) {
      return res.status(429).json({
        status: 'error',
        message: otpResult.error,
        errorCode: otpResult.errorCode,
        waitTime: otpResult.waitTime
      });
    }

    // Send OTP email
    const emailResult = await emailService.sendRegistrationOTP(email, otpResult.otpCode, user.name);

    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
    }

    res.json({
      status: 'success',
      message: 'OTP sent successfully. Please check your email.',
      payload: {
        expirationMinutes: otpResult.expirationMinutes
      }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resend OTP'
    });
  }
});

// Login endpoint
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await queryOne(
      `SELECT u.id, u.name, u.username, u.email, u.password,
              p.bio, p."profilePictureUrl"
       FROM "user" u 
       LEFT JOIN profile p ON u.id = p."userId" 
       WHERE u.email = $1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      status: 'success',
      message: 'Login successful',
      payload: {
        token,
        user: userWithoutPassword
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to login'
    });
  }
});


// Verify token endpoint - Now also refreshes token if needed
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.username, u.email,
              p.bio, p."profilePictureUrl"
       FROM "user" u 
       LEFT JOIN profile p ON u.id = p."userId" 
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if we need to issue a new token (if current token expires within 1 hour)
    const authHeader = req.headers['authorization'];
    const currentToken = authHeader && authHeader.split(' ')[1];
    let newToken = null;

    if (currentToken) {
      try {
        const decoded = jwt.verify(currentToken, process.env.JWT_SECRET);
        const now = Date.now() / 1000;
        const timeUntilExpiry = decoded.exp - now;
        
        // If token expires within 1 hour, issue a new one
        if (timeUntilExpiry < 3600) {
          newToken = generateToken(user.id, user.email);
          console.log('Issued new token for user', user.id);
        }
      } catch (error) {
        // If there's an error verifying the token, we shouldn't reach here
        // but just in case, issue a new token
        newToken = generateToken(user.id, user.email);
      }
    }

    const response = {
      status: 'success',
      message: 'Token verified',
      payload: {
        user,
        ...(newToken && { token: newToken })
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify token'
    });
  }
});

// Logout endpoint (client-side token removal, but we can add token blacklisting here if needed)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// Forgot Password - Request reset link/OTP
router.post('/forgot-password', async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Normalize email to prevent case sensitivity issues and match registration normalization
    email = email.trim().toLowerCase();
    const originalEmailInput = email;
    // For Gmail addresses, match registration's normalizeEmail behavior: remove dots and subaddress
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      const local = email.slice(0, atIndex);
      let domain = email.slice(atIndex + 1);
      if (domain === 'googlemail.com') domain = 'gmail.com';
      if (domain === 'gmail.com') {
        const localNoPlus = local.split('+')[0];
        const localNoDots = localNoPlus.replace(/\./g, '');
        email = `${localNoDots}@${domain}`;
      }
    }

    // Check if user exists
    const user = await queryOne(
      'SELECT id, name, email, email_verified FROM "user" WHERE LOWER(email) = $1',
      [email]
    );

    if (!user) {
  console.warn(`[forgot-password] No user found for email. input=${originalEmailInput}, normalized=${email}. Returning generic success.`);
      return res.json({
        status: 'success',
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Check if email is verified
    if (!user.email_verified) {
      // Generate and send registration OTP instead
      const registrationOTP = await otpService.createOTP(email, 'registration', 10);
      
      if (registrationOTP.success) {
        await emailService.sendRegistrationOTP(
          email,
          registrationOTP.otpCode,
          user.name
        );
      }

      return res.status(400).json({
        status: 'error',
        message: 'Please verify your email first. We have sent a new verification code to your email.',
        requiresVerification: true,
        email: email
      });
    }

    // Generate OTP for password reset
  const otpCode = await otpService.generateOTPForUser(user.id, 'password_reset');
  console.log(`[forgot-password] Generated password reset OTP for user ${user.id} (${email}): ${otpCode}`);

    // Send password reset OTP email
    const emailResult = await emailService.sendPasswordResetOTP(
      user.email,
      otpCode,
      user.name
    );

    if (!emailResult.success) {
      console.error(`[forgot-password] Failed to send password reset email to ${email}:`, emailResult.error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.json({
      status: 'success',
      message: 'Password reset code sent to your email. Please check your inbox.',
      payload: {
        email: user.email,
        devOTP: process.env.NODE_ENV === 'development' ? otpCode : undefined
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process password reset request'
    });
  }
});

// Verify Reset OTP
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and OTP code are required'
      });
    }

    // Get user
    const user = await queryOne(
      'SELECT id, email FROM "user" WHERE email = $1',
      [email]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify OTP
    const isValid = await otpService.verifyOTP(user.id, otpCode, 'password_reset');

    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset code'
      });
    }

    // Generate a temporary reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      status: 'success',
      message: 'Reset code verified successfully',
      payload: {
        resetToken,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify reset code'
    });
  }
});

// Reset Password with verified token
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      
      if (decoded.purpose !== 'password_reset') {
        throw new Error('Invalid token purpose');
      }
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE "user" SET password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, decoded.userId]
    );

    // Invalidate all OTPs for this user
    await otpService.invalidateOTPs(decoded.userId, 'password_reset');

    res.json({
      status: 'success',
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password'
    });
  }
});

module.exports = router;
