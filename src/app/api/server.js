const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const wsService = require('./services/websocket-service');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const emailService = require('./services/email.service');

// Security middleware - adjusted for development
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Note: Move rate limiting AFTER CORS/preflight handling and skip OPTIONS to avoid counting preflights

// CORS configuration - Enhanced for Render deployment
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Use a normalized allowlist without trailing slashes
    const allowedOrigins = [
      'http://localhost:4200',
      'http://localhost:3000',
      'https://artlink-api.onrender.com',
      'https://art-link.site',
      'https://www.art-link.site',
      'https://art-link.online',
      'https://www.art-link.online',
      'https://artlink.vercel.app',
      'https://art-link.vercel.app',
      'https://artlink-seven.vercel.app',
      'https://art-link-seven.vercel.app'
    ];

    // Accept exact matches OR subdomains of art-link.online
    const allowBySuffix = (orig) => {
      try {
        const url = new URL(orig);
        const host = url.hostname;
        return host === 'art-link.online' || host.endsWith('.art-link.online');
      } catch {
        return false;
      }
    };

    if (allowedOrigins.includes(origin) || allowBySuffix(origin)) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false
}));

// Additional CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:4200');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Rate limiting (after CORS so that preflights are handled first)
const commonLimiterOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count preflight or websocket upgrade requests
  skip: (req) => req.method === 'OPTIONS' || req.headers.upgrade === 'websocket'
};

// Stricter limiter for auth endpoints (login/register)
const authLimiter = rateLimit({
  ...commonLimiterOptions,
  max: 50 // per IP per window for auth-specific routes
});

// General API limiter (higher to accommodate admin console bursty loads)
const apiLimiter = rateLimit({
  ...commonLimiterOptions,
  max: 2000
});

// Even higher allowance for admin endpoints (GET heavy dashboards, charts)
const adminLimiter = rateLimit({
  ...commonLimiterOptions,
  max: 4000
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  // Configure static file serving with CORS
  setHeaders: (res, filePath) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  }
}));

// Routes with scoped limiters
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/posts', apiLimiter, postRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/listings', apiLimiter, listingRoutes);
app.use('/api/messages', apiLimiter, messageRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Import database function
    const { query } = require('./config/database');
    
    // Test database connection
    await query('SELECT 1 as test');
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check database error:', error.message);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Email health endpoint
app.get('/api/email/health', (req, res) => {
  try {
    const status = emailService.getStatus();
    const ok = status.initialized && status.hasClient && status.hasApiKey && !!status.from;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      provider: 'Resend',
      initialized: status.initialized,
      hasClient: status.hasClient,
      hasApiKey: status.hasApiKey,
      fromConfigured: !!status.from,
      from: status.from || undefined,
      lastInitError: status.lastInitError || undefined
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});



// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 ArtLink API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize Archive Cleanup Service
  const archiveCleanupService = require('./services/archive-cleanup.service');
  archiveCleanupService.start();
});

// WebSocket connection handling
const clients = new Map(); // Store client connections with user IDs

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('WebSocket message received:', data);
      
      switch (data.type) {
        case 'auth':
          // Store the connection with user ID
          if (data.userId) {
            clients.set(data.userId, ws);
            wsService.addClient(data.userId, ws);
            ws.userId = data.userId;
            console.log(`User ${data.userId} authenticated via WebSocket`);
          }
          break;
          
        case 'message':
          // Handle real-time messaging
          const recipient = clients.get(data.to);
          if (recipient && recipient.readyState === WebSocket.OPEN) {
            recipient.send(JSON.stringify({
              type: 'message',
              from: data.from,
              content: data.content,
              timestamp: new Date().toISOString()
            }));
            
            // Send delivery confirmation to sender
            ws.send(JSON.stringify({
              type: 'message_delivered',
              to: data.to,
              timestamp: data.timestamp
            }));
          }
          break;
          
        case 'notification':
          // Handle real-time notifications
          const notificationRecipient = clients.get(data.to);
          if (notificationRecipient && notificationRecipient.readyState === WebSocket.OPEN) {
            notificationRecipient.send(JSON.stringify({
              type: 'notification',
              content: data.content
            }));
          }
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove client from map when connection closes
    if (ws.userId) {
      clients.delete(ws.userId);
      wsService.removeClient(ws.userId);
      console.log(`User ${ws.userId} disconnected from WebSocket`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      console.log('Process terminated');
    });
  });
});
