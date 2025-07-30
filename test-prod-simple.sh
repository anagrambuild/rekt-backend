#!/bin/bash

# Simple Production Test (no dependencies)
# Usage: ./test-prod-simple.sh https://your-render-url.onrender.com

if [ -z "$1" ]; then
    echo "❌ Please provide your Render URL"
    echo "Usage: ./test-prod-simple.sh https://your-render-url.onrender.com"
    exit 1
fi

PROD_URL="$1"

echo "🚀 Simple Production Test for REKT Trading Backend"
echo "=================================================="
echo "🌐 Testing: $PROD_URL"
echo ""

echo "🔍 1. Health Check..."
HEALTH=$(curl -s "$PROD_URL/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Health check: PASS"
else
    echo "❌ Health check: FAIL"
    echo "$HEALTH"
fi

echo ""
echo "🔍 2. Status API..."
STATUS=$(curl -s "$PROD_URL/api/status")
if echo "$STATUS" | grep -q "healthy"; then
    echo "✅ Status API: PASS"
else
    echo "❌ Status API: FAIL"
    echo "$STATUS"
fi

echo ""
echo "🔍 3. Markets API..."
MARKETS=$(curl -s "$PROD_URL/api/markets")
if echo "$MARKETS" | grep -q "SOL-PERP"; then
    echo "✅ Markets API: PASS"
    echo "📊 Found market data with SOL-PERP"
else
    echo "❌ Markets API: FAIL"
    echo "$MARKETS"
fi

echo ""
echo "🔍 4. SOL Price API..."
SOL_PRICE=$(curl -s "$PROD_URL/api/markets/SOL-PERP/price")
if echo "$SOL_PRICE" | grep -q "price"; then
    echo "✅ SOL Price API: PASS"
else
    echo "❌ SOL Price API: FAIL"
    echo "$SOL_PRICE"
fi

echo ""
echo "✅ Production test complete!"
echo ""
echo "🎯 Next steps:"
echo "1. If all tests pass, your backend is working!"
echo "2. Update your frontend to use: $PROD_URL"
echo "3. Test the full user flow in production"
