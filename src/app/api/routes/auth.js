const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { validateRegister, validateLogin, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

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

// Register endpoint
router.post('/register', validateRegister, handleValidationErrors, async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT id FROM "user" WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await query(
      'INSERT INTO "user" (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, username, email, hashedPassword]
    );

    const userId = result[0].id;

    // Create user profile
    await query(
      'INSERT INTO profile ("userId", bio, "profilePictureUrl") VALUES ($1, $2, $3)',
      [userId, '', null]
    );

    // Generate token
    const token = generateToken(userId, email);

    // Get created user (without password)
    const newUser = await queryOne(
      `SELECT u.id, u.name, u.username, u.email, 
              p.bio, p."profilePictureUrl"
       FROM "user" u 
       LEFT JOIN profile p ON u.id = p."userId" 
       WHERE u.id = $1`,
      [userId]
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      payload: {
        token,
        user: newUser
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

// Test endpoint for debugging
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug token endpoint - helps diagnose token issues
router.get('/debug-token', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({
      status: 'debug',
      message: 'No token provided',
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader ? 'Bearer [TOKEN]' : null
    });
  }

  try {
    // Decode without verification first to see token content
    const decoded = jwt.decode(token);
    const now = Date.now() / 1000;
    
    return res.json({
      status: 'debug',
      message: 'Token decoded successfully',
      tokenInfo: {
        userId: decoded?.userId,
        email: decoded?.email,
        issuer: decoded?.iss,
        issuedAt: decoded?.iat ? new Date(decoded.iat * 1000).toISOString() : null,
        expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        currentTime: new Date(now * 1000).toISOString(),
        isExpired: decoded?.exp ? decoded.exp < now : 'unknown',
        timeUntilExpiry: decoded?.exp ? Math.round(decoded.exp - now) : 'unknown'
      }
    });
  } catch (error) {
    return res.json({
      status: 'debug',
      message: 'Token decode failed',
      error: error.message
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
