# REKT Backend Deployment Guide

## 🚀 Production Deployment on Render

This guide covers deploying the REKT backend to Render.com for production use.

## 📋 Architecture Overview

- **Repository**: Single monorepo with multiple services
- **User Management Backend**: `render-backend/` directory
- **Trading Backend**: Root directory (`src/`)
- **Frontend**: Served by trading backend (`public/`)

## 🔧 Phase 1: User Management Backend

### 1.1 Render Service Setup

1. **Create Render Account**: Sign up at [render.com](https://render.com)
2. **Connect Repository**: Link your GitHub repository `anagrambuild/rekt-backend`
3. **Create Web Service**:
   - **Name**: `rekt-user-management`
   - **Root Directory**: `render-backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (can upgrade to Starter $7/month later)

### 1.2 Environment Variables

Set these in the Render dashboard under "Environment":

```bash
# Required - Set these manually for security
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Auto-configured by render.yaml
SUPABASE_URL=https://amgeuvathssbhopfvubw.supabase.co
NODE_ENV=production
PORT=10000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 1.3 Health Check

The service includes a health check endpoint at `/health` that Render will use to monitor service status.

### 1.4 Testing User Management Backend

Once deployed, test these endpoints:

```bash
# Health check
curl https://your-service-url.onrender.com/health

# Username availability
curl -X POST https://your-service-url.onrender.com/api/auth/check-username \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}'

# Email check
curl -X POST https://your-service-url.onrender.com/api/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## 🔧 Phase 2: Trading Backend (Coming Next)

After the user management backend is deployed and tested, we'll deploy the trading backend with:

- Drift SDK integration
- WebSocket support
- Real-time market data
- Static file serving for frontend

## 🌐 Frontend Configuration

The frontend automatically detects the environment:

- **Local Development**: Uses `localhost:3005` for auth API
- **Production**: Uses your Render URL for auth API

## 📊 Monitoring & Logs

- **Render Dashboard**: Monitor deployments, logs, and metrics
- **Health Checks**: Automatic monitoring via `/health` endpoint
- **Error Tracking**: Server logs available in Render dashboard

## 🔒 Security Notes

- Environment variables with sensitive data (API keys) are set manually in Render dashboard
- CORS is configured for production domains
- Rate limiting is enabled for all endpoints
- Helmet.js provides security headers

## 💰 Cost Estimation

- **Free Tier**: $0/month (750 hours total, cold starts)
- **Starter Tier**: $7/month per service (always-on, no cold starts)

## 🚨 Troubleshooting

### Common Issues:

1. **Cold Start Delays**: Free tier services sleep after 15 minutes of inactivity
2. **Environment Variables**: Double-check all required env vars are set
3. **CORS Issues**: Ensure frontend domain is in CORS allowlist
4. **Database Connection**: Verify Supabase credentials are correct

### Debug Steps:

1. Check Render service logs in dashboard
2. Test health endpoint: `curl https://your-service.onrender.com/health`
3. Verify environment variables in Render settings
4. Test individual API endpoints with curl

## 📞 Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Service Logs**: Available in Render dashboard
- **Health Status**: Monitor via `/health` endpoint
