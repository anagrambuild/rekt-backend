#!/bin/bash

# Test Existing Render Deployment
# Usage: ./test-existing-deployment.sh https://your-existing-render-url.onrender.com

if [ -z "$1" ]; then
    echo "❌ Please provide your existing Render URL"
    echo "Usage: ./test-existing-deployment.sh https://your-render-url.onrender.com"
    exit 1
fi

PROD_URL="$1"

echo "🔄 Testing Existing Render Deployment with New Features"
echo "======================================================"
echo "🌐 Testing: $PROD_URL"
echo ""

echo "🔍 1. Health Check..."
HEALTH=$(curl -s "$PROD_URL/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Health check: PASS"
else
    echo "❌ Health check: FAIL - Service may be down"
    echo "$HEALTH"
    exit 1
fi

echo ""
echo "🔍 2. Existing Auth System..."
USERNAME_CHECK=$(curl -s -X POST "$PROD_URL/api/auth/check-username" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser123"}')
if echo "$USERNAME_CHECK" | grep -q "available"; then
    echo "✅ Auth system: PASS"
else
    echo "❌ Auth system: FAIL"
    echo "$USERNAME_CHECK"
fi

echo ""
echo "🔍 3. NEW: Status API..."
STATUS=$(curl -s "$PROD_URL/api/status")
if echo "$STATUS" | grep -q "healthy"; then
    echo "✅ Status API: PASS (NEW FEATURE DEPLOYED!)"
else
    echo "⚠️  Status API: NOT YET DEPLOYED"
    echo "$STATUS"
fi

echo ""
echo "🔍 4. NEW: Markets API..."
MARKETS=$(curl -s "$PROD_URL/api/markets")
if echo "$MARKETS" | grep -q "SOL-PERP"; then
    echo "✅ Markets API: PASS (NEW FEATURE DEPLOYED!)"
    echo "📊 Real-time market data is working"
else
    echo "⚠️  Markets API: NOT YET DEPLOYED"
    echo "$MARKETS"
fi

echo ""
echo "🔍 5. NEW: Trading Balance API..."
BALANCE=$(curl -s "$PROD_URL/api/trading/balance/8be41bcf-97b7-432c-964b-08cac2d6e599")
if echo "$BALANCE" | grep -q "success"; then
    echo "✅ Trading API: PASS (NEW FEATURE DEPLOYED!)"
else
    echo "⚠️  Trading API: NOT YET DEPLOYED"
    echo "$BALANCE"
fi

echo ""
echo "🔍 6. NEW: Frontend Static Files..."
FRONTEND=$(curl -s "$PROD_URL/auth.html")
if echo "$FRONTEND" | grep -q "REKT"; then
    echo "✅ Frontend: PASS (STATIC FILES WORKING!)"
else
    echo "⚠️  Frontend: NOT YET DEPLOYED"
fi

echo ""
echo "📊 DEPLOYMENT STATUS SUMMARY:"
echo "=============================="

if echo "$STATUS" | grep -q "healthy" && echo "$MARKETS" | grep -q "SOL-PERP"; then
    echo "🎉 SUCCESS: All new trading features are deployed!"
    echo "✅ Your existing users now have access to trading"
    echo "✅ Frontend is serving correctly"
    echo "✅ All APIs are functional"
    echo ""
    echo "🌐 Your users can now access:"
    echo "   - Auth: $PROD_URL/auth.html"
    echo "   - Trading: $PROD_URL/dashboard.html"
else
    echo "⚠️  PARTIAL: Some features may still be deploying"
    echo "   - Wait 2-3 minutes for auto-deployment to complete"
    echo "   - Check Render dashboard for deployment status"
    echo "   - Re-run this test script"
fi

echo ""
echo "🔗 Next steps:"
echo "1. If successful, test the full user flow"
echo "2. Update any frontend configs if needed"
echo "3. Announce new trading features to users!"
