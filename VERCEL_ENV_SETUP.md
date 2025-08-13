# VERCEL ENVIRONMENT VARIABLES SETUP
# Copy these to your Vercel project settings

# 1. Go to https://vercel.com/dashboard
# 2. Select your ArtLink project
# 3. Go to Settings > Environment Variables
# 4. Add each of these variables:

DB_HOST=db.janjfrncevmlrrifb.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASS=your-actual-password-from-supabase
DB_NAME=postgres
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters
NODE_ENV=production

# IMPORTANT NOTES:
# - Replace 'your-actual-password-from-supabase' with your real Supabase password
# - Replace 'your-super-secure-jwt-secret-key-minimum-32-characters' with a strong secret
# - Set all variables for "Production", "Preview", and "Development" environments
