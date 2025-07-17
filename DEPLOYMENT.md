# REKT User Management - Render Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `anagrambuild/rekt-backend`
4. Configure the service:

**Basic Settings:**

- **Name**: `rekt-user-management`
- **Region**: Oregon (US West)
- **Branch**: `main`
- **Root Directory**: `render-backend`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Environment Variables:**

```
SUPABASE_URL=https://amgeuvathssbhopfvubw.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZ2V1dmF0aHNzYmhvcGZ2dWJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzUwNTQwMywiZXhwIjoyMDYzMDgxNDAzfQ.2kojQiE653EyG4OUVtufj7cEzU_SwMiUMvovGJwIp4E
NODE_ENV=production
```

### 2. Expected Deployment URL

Once deployed, your service will be available at:
`https://rekt-user-management.onrender.com`

### 3. Test Endpoints After Deployment

**Health Check:**

```bash
curl https://rekt-user-management.onrender.com/health
```

**Create Account:**

```bash
curl -X POST https://rekt-user-management.onrender.com/api/auth/create-account \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","avatarUrl":"","swigWalletAddress":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"}'
```

**Sign In:**

```bash
curl -X POST https://rekt-user-management.onrender.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## 🔧 Frontend Integration

The frontend (`public/auth.js`) is already configured to automatically detect:

- **Local Development**: `http://localhost:3001`
- **Production**: `https://rekt-user-management.onrender.com`

## 📊 Database Configuration

**Supabase Project**: `amgeuvathssbhopfvubw`

- ✅ Service role key configured
- ✅ RLS policies bypassed for backend operations
- ✅ All required fields in `profiles` table

## 🧪 Testing Checklist

After deployment, verify:

- [ ] Health endpoint responds
- [ ] Username availability check works
- [ ] Email existence check works
- [ ] Account creation inserts to database
- [ ] Sign in retrieves user data
- [ ] Frontend auth flow works end-to-end

## 🚨 Troubleshooting

**Common Issues:**

1. **Build fails**: Check that `render-backend/package.json` exists
2. **Environment variables**: Ensure all vars are set in Render dashboard
3. **Database errors**: Verify Supabase service key is correct
4. **CORS issues**: Check CORS origins in server.js include production URL

## 📁 File Structure

```
render-backend/
├── server.js              # Main Express server
├── package.json            # Dependencies
├── routes/
│   └── auth-simple.js      # Authentication endpoints
├── middleware/
│   ├── supabase.js         # Database connection
│   └── validation.js       # Input validation
└── utils/
    └── storage.js          # File upload utilities
```
