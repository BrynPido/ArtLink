const { Pool } = require('pg');
require('dotenv').config();

// Database configuration for PostgreSQL/Supabase
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, // Always use SSL for Supabase
  max: 20, // Increased pool size
  min: 2, // Minimum connections
  idleTimeoutMillis: 60000, // Increased idle timeout
  connectionTimeoutMillis: 10000, // Reduced connection timeout
  acquireTimeoutMillis: 60000, // Time to wait for connection
  createTimeoutMillis: 30000, // Time to wait for connection creation
  destroyTimeoutMillis: 5000, // Time to wait for connection destruction
  reapIntervalMillis: 1000, // Cleanup interval
  createRetryIntervalMillis: 200, // Retry interval for failed connections
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit process, let the pool handle reconnection
});

pool.on('connect', () => {
  console.log('🔗 New database connection established');
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
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
