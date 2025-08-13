# ArtLink API Deployment

## Quick Deploy to Vercel

1. **Create a new Vercel project for your API:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub repository
   - **Important**: Set the root directory to `src/app/api` (not the main folder)

2. **Set Environment Variables in Vercel:**
   Go to your Vercel project → Settings → Environment Variables and add:
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

3. **Deploy Settings:**
   - Build Command: `npm install`
   - Output Directory: (leave empty)
   - Install Command: `npm install`

4. **After deployment, your API will be available at:**
   `https://your-api-name.vercel.app`

## Update Frontend

Once your API is deployed, update your Angular environment:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-api-name.vercel.app/api/',  // Your actual API URL
  mediaBaseUrl: 'https://your-api-name.vercel.app/',
  wsUrl: 'wss://your-api-name.vercel.app'  // WebSocket URL
};
```

Then rebuild and redeploy your Angular app.
