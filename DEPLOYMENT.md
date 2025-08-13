# ArtLink Deployment Guide

## Environment Configuration

This project uses Angular environment files to manage different configurations for development and production.

### Environment Files

1. **Development** (`src/environments/environment.ts`):
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3000/api/',
     mediaBaseUrl: 'http://localhost:3000',
     wsUrl: 'ws://localhost:3000'
   };
   ```

2. **Production** (`src/environments/environment.prod.ts`):
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://your-api-domain.vercel.app/api/',
     mediaBaseUrl: 'https://your-api-domain.vercel.app',
     wsUrl: 'wss://your-websocket-domain.com'
   };
   ```

## Deployment Steps

### 1. Update Production Environment

Before deploying, update `src/environments/environment.prod.ts` with your actual URLs:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-actual-api-domain.vercel.app/api/',
  mediaBaseUrl: 'https://your-actual-api-domain.vercel.app',
  wsUrl: 'wss://your-actual-websocket-domain.com'
};
```

### 2. Frontend Deployment (Vercel)

1. Build the production version:
   ```bash
   ng build --configuration=production
   ```

2. Deploy to Vercel:
   - Connect your GitHub repository to Vercel
   - Set build command: `ng build --configuration=production`
   - Set output directory: `dist/art-link`
   - Deploy

### 3. Backend API Deployment

Your Node.js API can be deployed to:
- Vercel (recommended for full-stack)
- Railway
- Render
- AWS/Google Cloud

### 4. Database Configuration

Update your API's `.env` file for production:
```properties
# Production Database
DB_HOST=your-production-db-host
DB_NAME=your-production-db-name
DB_USER=your-production-db-user
DB_PASS=your-production-db-password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_ISSUER=ArtlinkAdmin
JWT_EXPIRATION=24h
```

### 5. WebSocket Configuration

If using a separate WebSocket server, update the `wsUrl` in the production environment file.

## Important Notes

- **Never commit sensitive data** like database passwords or JWT secrets to GitHub
- **Update CORS settings** in your API to allow your production frontend domain
- **Set up proper SSL/TLS** for HTTPS in production
- **Configure rate limiting** for production API endpoints
- **Set up monitoring** and error tracking for production

## Development vs Production

The application automatically uses the correct environment based on the build configuration:
- `ng serve` uses `environment.ts` (development)
- `ng build --configuration=production` uses `environment.prod.ts` (production)

This ensures your media URLs, API endpoints, and WebSocket connections work correctly in both environments.
