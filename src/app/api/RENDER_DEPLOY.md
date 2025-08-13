# ArtLink API - Render Deployment Guide

## 🚀 Deploy to Render

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up or sign in with GitHub

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `BrynPido/ArtLink`
3. Configure the service:

**Settings:**
- **Name**: `artlink-api`
- **Root Directory**: `src/app/api`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 3: Set Environment Variables
Add these in the Environment Variables section:

```
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=6543
DB_USER=postgres.janjfnnvvnnylruflpzo
DB_PASS=Artlink12!
DB_NAME=postgres
NODE_ENV=production
JWT_SECRET=f14d93a857312edeb19c224ca48c70290e9b525324ab5e88b3a99c042d504496
JWT_ISSUER=ArtlinkAdmin
JWT_EXPIRATION=24h
```

### Step 4: Deploy
1. Click "Create Web Service"
2. Wait for deployment (usually 5-10 minutes)
3. Your API will be available at: `https://artlink-api.onrender.com`

### Step 5: Update Frontend
Update your Angular environment to use the new API URL:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://artlink-api.onrender.com/api/',
  mediaBaseUrl: 'https://artlink-api.onrender.com/',
  wsUrl: 'wss://artlink-api.onrender.com'
};
```

## Why Render is Better for This Project

✅ **Full Node.js support** - No serverless limitations  
✅ **WebSocket support** - Real-time messaging works  
✅ **File uploads** - Image/media uploads work properly  
✅ **Database connections** - Persistent connections to Supabase  
✅ **Background processes** - No timeout issues  
✅ **Free tier** - Good for development and testing  

## Features That Will Work on Render

- ✅ Authentication & JWT
- ✅ Real-time messaging with WebSocket
- ✅ File uploads (images, media)
- ✅ Database operations with Supabase
- ✅ CORS handling
- ✅ Rate limiting
- ✅ All API endpoints

## Test Endpoints After Deployment

- Health check: `https://artlink-api.onrender.com/api/health`
- Auth: `https://artlink-api.onrender.com/api/auth/login`
- Posts: `https://artlink-api.onrender.com/api/posts`
