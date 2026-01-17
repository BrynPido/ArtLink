# Database Connection Troubleshooting Guide

## Issue: Connection Timeout on Deployment

If you're seeing `❌ Database connection failed: Connection terminated due to connection timeout`, follow these steps:

## 1. Check Environment Variables

Your deployment platform needs these environment variables set:

### Option A: Using DATABASE_URL (Recommended for Render/Heroku)
```
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
```

### Option B: Using Individual Credentials
```
DB_HOST=your-database-host.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASS=your-password
DB_NAME=postgres
```

### Additional Required Variables
```
JWT_SECRET=your-jwt-secret
NODE_ENV=production
RESEND_API_KEY=your-resend-api-key
```

## 2. Database Firewall/IP Whitelist

**Most Common Issue:** Your database (Supabase/PostgreSQL) needs to allow connections from your deployment server.

### For Supabase:
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection Pooling** section
4. Under **Network Restrictions**, add your deployment server's IP
5. **Or** disable IP restrictions temporarily (not recommended for production)

### For Render.io Deployments:
Render uses dynamic IPs, so you need to:
- In Supabase, **disable IP restrictions** entirely, OR
- Add Render's IP range (check Render documentation for current ranges)

### For Other Hosting Providers:
- Find your server's outbound IP address
- Add it to your database's allowed IP list

## 3. Connection String Format

If using Supabase, get your connection string from:
1. Supabase Dashboard → **Settings** → **Database**
2. Copy the **Connection String** (not the pooler URL)
3. Replace `[YOUR-PASSWORD]` with your actual database password
4. Set it as `DATABASE_URL` in your deployment environment

Example:
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

## 4. SSL Configuration

The code is configured to accept SSL connections (`rejectUnauthorized: false`). This should work with Supabase and most PostgreSQL providers.

## 5. Test Locally First

Before deploying, test your connection locally:

```bash
cd src/app/api
node -e "require('./config/database.js')"
```

This will test the connection and show detailed error messages.

## 6. Recent Changes Made

The following improvements have been made to handle connection issues better:

1. **Increased connection timeout** from 10s to 30s
2. **Added retry logic** - 5 attempts with 5s delay between each
3. **Support for DATABASE_URL** - Now works with both connection string and individual credentials
4. **Non-blocking startup** - Server won't crash if DB is temporarily unavailable
5. **Better error logging** - Shows which connection method is being used
6. **Keep-alive enabled** - Maintains connections in deployed environments

## 7. Check Deployment Logs

After deploying, check if you see:
```
📝 Using DATABASE_URL for database connection
```
or
```
📝 Using individual credentials for database connection
```

This tells you which connection method is being used.

## 8. Common Deployment Platform Instructions

### Render.io
1. Go to your service dashboard
2. Click **Environment** tab
3. Add environment variables
4. **Important:** Click **Save Changes** and the service will auto-redeploy

### Vercel (for serverless functions)
1. Project Settings → Environment Variables
2. Add all required variables
3. Redeploy

### Heroku
```bash
heroku config:set DATABASE_URL="postgresql://..."
```

## Need More Help?

Check the detailed logs after deployment. The new configuration will show:
- Which connection method is being used
- Connection retry attempts
- Detailed error messages
- Configuration (without sensitive data)
