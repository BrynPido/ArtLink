# Supabase Setup Guide for ArtLink

## 🎯 Supabase is Perfect for Your Project!

**Why Supabase rocks:**
- ✅ **Free tier: 500MB database** (more than enough for you)
- ✅ **PostgreSQL-based** (robust and reliable)
- ✅ **Built-in authentication** (bonus feature!)
- ✅ **Excellent Vercel integration**
- ✅ **Real-time subscriptions** (great for chat features)

## 📋 Step-by-Step Setup

### Step 1: Import Your Database Schema

**I can see you already have the SQL Editor open! Perfect!**

1. **Copy the entire content** from `supabase-schema.sql` (I just created this)
2. **Paste it in the SQL Editor** (where it says "Hit Ctrl+R to generate query or just start typing")
3. **Click "Run" (the green button)**
4. **Wait for it to complete** - you should see "Success" messages

### Step 2: Verify Your Data

**Run these queries to check everything imported correctly:**

```sql
-- Check if all tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check your data
SELECT COUNT(*) as users FROM "user";
SELECT COUNT(*) as profiles FROM profile;
SELECT COUNT(*) as posts FROM post;
SELECT COUNT(*) as listings FROM listing;
SELECT COUNT(*) as messages FROM message;
```

**You should see:**
- 13 tables created
- 3 users, 3 profiles, 2 posts, 1 listing, 13 messages

### Step 3: Get Connection Details

1. **Go to Settings → Database** in Supabase
2. **Copy your connection details:**
   - Host
   - Database name
   - Port (usually 5432)
   - User
   - Password

**Or better yet, use the connection string:**
- Look for "URI" in the connection info
- It looks like: `postgresql://user:pass@host:5432/database`

### Step 4: Update Your Database Configuration

**Update your `src/app/api/config/database.js` for PostgreSQL:**

```javascript
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration for PostgreSQL/Supabase
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000,
};

// Create connection pool
const pool = new Pool(dbConfig);

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

// Helper function to execute queries
async function query(text, params = []) {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to get a single row
async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = {
  pool,
  query,
  queryOne,
  testConnection
};
```

### Step 5: Install PostgreSQL Driver

**Run this in your terminal:**

```bash
npm install pg
```

### Step 6: Environment Variables for Vercel

**Add these to your Vercel project settings:**

```
DB_HOST=db.your-project-ref.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASS=your-database-password
DB_NAME=postgres
JWT_SECRET=your-secure-jwt-secret-here
NODE_ENV=production
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Step 7: Update SQL Queries (if needed)

**PostgreSQL uses slightly different syntax than MySQL:**

- MySQL: `LIMIT 10`
- PostgreSQL: `LIMIT 10` ✅ (same)

- MySQL: `AUTO_INCREMENT`  
- PostgreSQL: `SERIAL` ✅ (already handled)

- MySQL: backticks `\`table\``
- PostgreSQL: double quotes `"table"` ✅ (already handled)

### Step 8: Test Your Connection

1. **Deploy to Vercel** with new environment variables
2. **Check deployment logs** for "✅ Database connected successfully"
3. **Test your app:**
   - User registration/login
   - Creating posts
   - Messaging features

## 🎉 Why This Setup Rocks

### Immediate Benefits:
- **Real-time features** - Supabase has built-in real-time subscriptions
- **Authentication** - You can use Supabase Auth if you want
- **Storage** - Built-in file storage for images
- **Dashboard** - Beautiful admin interface
- **Free tier** - Very generous limits

### Future Possibilities:
- **Row Level Security (RLS)** - Advanced security features
- **Edge Functions** - Serverless functions
- **Real-time chat** - WebSocket alternative
- **File uploads** - Direct to Supabase storage

## 🆓 Free Tier Limits (More Than Enough!)

- **Database:** 500MB (your current DB is ~1MB)
- **Auth users:** 50,000
- **API requests:** 500,000/month
- **Storage:** 1GB
- **Bandwidth:** 2GB

**Your ArtLink app can easily handle 1000+ users on the free tier!**

---

## Ready to Go!

Just run the SQL I provided, update your database config, and you'll have a production-ready database! 🚀
