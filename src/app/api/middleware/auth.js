const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Enhanced logging for production debugging
  console.log('🔍 Auth middleware - Token validation:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (!token) {
    console.log('🔍 Auth middleware - No token provided');
    return res.status(401).json({
      status: 'error',
      message: 'Access token required'
    });
  }

  try {
    // Log JWT secret availability (but not the actual secret)
    console.log('🔍 Auth middleware - JWT config:', {
      hasJwtSecret: !!process.env.JWT_SECRET,
      jwtSecretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
      expectedIssuer: process.env.JWT_ISSUER || 'ArtlinkAdmin'
    });

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('🔍 Auth middleware - Token decoded:', {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      issuer: decoded.iss,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'no expiry'
    });
    
    // Support both 'id' and 'userId' fields for compatibility
    const userId = decoded.id || decoded.userId;
    
    // Additional validation: Check if token has required fields
    if (!userId || !decoded.email) {
      console.log('🔍 Auth middleware - Invalid token structure');
      return res.status(403).json({
        status: 'error',
        message: 'Invalid token structure'
      });
    }
    
    // Check if token is from the correct issuer
    if (decoded.iss && decoded.iss !== (process.env.JWT_ISSUER || 'ArtlinkAdmin')) {
      console.log('🔍 Auth middleware - Invalid token issuer:', decoded.iss);
      return res.status(403).json({
        status: 'error',
        message: 'Invalid token issuer'
      });
    }
    
    // Verify user still exists in database
    const user = await queryOne(
      'SELECT id, email, name, username FROM "user" WHERE id = $1',
      [userId]
    );

    if (!user) {
      console.log('🔍 Auth middleware - User not found in database:', userId);
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    console.log('🔍 Auth middleware - Authentication successful for user:', user.id);
    req.user = user;
    next();
  } catch (error) {
    console.error('🔍 Auth middleware - Token verification error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Provide more specific error messages
    let errorMessage = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token format';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token not active yet';
    }
    
    return res.status(403).json({
      status: 'error',
      message: errorMessage
    });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 OptionalAuth - Processing request:', {
    url: req.url,
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    userAgent: req.headers['user-agent']
  });

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Support both 'id' and 'userId' fields for compatibility
      const userId = decoded.id || decoded.userId;
      
      console.log('🔍 OptionalAuth - Token decoded:', { userId, email: decoded.email });
      
      if (userId) {
        const user = await queryOne(
          'SELECT id, email, name, username FROM "user" WHERE id = $1',
          [userId]
        );
        req.user = user;
        console.log('🔍 OptionalAuth - User found:', { id: user?.id, email: user?.email });
      } else {
        req.user = null;
        console.log('🔍 OptionalAuth - No userId in token');
      }
    } catch (error) {
      // Token is invalid, but we continue without user
      console.log('🔍 OptionalAuth - Token error:', error.message);
      req.user = null;
    }
  } else {
    console.log('🔍 OptionalAuth - No token provided');
    req.user = null;
  }

  console.log('🔍 OptionalAuth - Final user state:', { userId: req.user?.id || 'null' });
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth
};
