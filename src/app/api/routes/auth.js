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

module.exports = router;
