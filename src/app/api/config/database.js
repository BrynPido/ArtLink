const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL (for platforms like Render) and individual credentials
let dbConfig;

if (process.env.DATABASE_URL) {
  // Use connection string if available (common on Render, Heroku, etc.)
  console.log('📝 Using DATABASE_URL for database connection');
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };
} else {
  // Use individual credentials
  console.log('📝 Using individual credentials for database connection');
  dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };
}

// Create connection pool
const pool = new Pool(dbConfig);

// Log configuration (without sensitive data) for debugging
console.log('🔧 Database Configuration:', {
  usingConnectionString: !!process.env.DATABASE_URL,
  host: dbConfig.host || 'from connection string',
  port: dbConfig.port || 'from connection string',
  database: dbConfig.database || 'from connection string',
  ssl: !!dbConfig.ssl,
  maxConnections: dbConfig.max
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
  // Don't exit process, let the pool handle reconnection
});

pool.on('connect', () => {
  console.log('🔗 New database connection established');
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

// Test database connection with retry logic
async function testConnection(retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
      return true;
    } catch (error) {
      console.error(`❌ Database connection failed (attempt ${attempt}/${retries}):`, error.message);
      
      if (attempt < retries) {
        console.log(`🔄 Retrying database connection in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ All database connection attempts failed. Server will continue but database operations will fail.');
        // Don't exit - let the server run and retry connections on actual queries
        return false;
      }
    }
  }
  return false;
}

// Initialize database connection
testConnection();

// Helper function to execute queries with retry logic
async function query(text, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error(`Database query error (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a connection error and we have retries left
      if (attempt < retries && (
        error.message.includes('Connection terminated') ||
        error.message.includes('Connection closed') ||
        error.message.includes('ECONNRESET') ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01'
      )) {
        console.log(`🔄 Retrying query in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      throw error;
    }
  }
}

// Helper function to get a single row
async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// Helper function to execute queries and return full result object (including rowCount)
async function queryWithResult(text, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result; // Return full result object, not just rows
    } catch (error) {
      console.error(`Database query error (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a connection error and we have retries left
      if (attempt < retries && (
        error.message.includes('Connection terminated') ||
        error.message.includes('Connection closed') ||
        error.message.includes('ECONNRESET') ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01'
      )) {
        console.log('Connection error detected, retrying...');
        continue;
      }
      
      throw error;
    }
  }
}

// Helper function to execute transactions
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  queryWithResult,
  transaction
};
