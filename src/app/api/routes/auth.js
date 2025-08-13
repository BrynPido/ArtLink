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
      'SELECT id FROM user WHERE email = ? OR username = ?',
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
      'INSERT INTO user (name, username, email, password) VALUES (?, ?, ?, ?)',
      [name, username, email, hashedPassword]
    );

    const userId = result.insertId;

    // Create user profile
    await query(
      'INSERT INTO profile (userId, bio, profilePictureUrl) VALUES (?, ?, ?)',
      [userId, '', null]
    );

    // Generate token
    const token = generateToken(userId, email);

    // Get created user (without password)
    const newUser = await queryOne(
      `SELECT u.id, u.name, u.username, u.email, 
              p.bio, p.profilePictureUrl
       FROM user u 
       LEFT JOIN profile p ON u.id = p.userId 
       WHERE u.id = ?`,
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
              p.bio, p.profilePictureUrl
       FROM user u 
       LEFT JOIN profile p ON u.id = p.userId 
       WHERE u.email = ?`,
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

// Verify token endpoint
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.username, u.email,
              p.bio, p.profilePictureUrl
       FROM user u 
       LEFT JOIN profile p ON u.id = p.userId 
       WHERE u.id = ?`,
      [req.user.id]
    );

    res.json({
      status: 'success',
      payload: {
        user
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
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
