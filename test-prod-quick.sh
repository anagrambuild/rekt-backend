#!/bin/bash

# Quick Production Test Script
# Usage: ./test-prod-quick.sh https://your-render-url.onrender.com

if [ -z "$1" ]; then
    echo "❌ Please provide your Render URL"
    echo "Usage: ./test-prod-quick.sh https://your-render-url.onrender.com"
    exit 1
fi

PROD_URL="$1"

echo "🚀 Quick Production Test for REKT Trading Backend"
echo "=================================================="
echo "🌐 Testing: $PROD_URL"
echo ""

echo "🔍 1. Health Check..."
curl -s "$PROD_URL/health" | jq '.' || echo "❌ Health check failed"

echo ""
echo "🔍 2. Status API..."
curl -s "$PROD_URL/api/status" | jq '.' || echo "❌ Status API failed"

echo ""
echo "🔍 3. Markets API..."
curl -s "$PROD_URL/api/markets" | jq '.data[0]' || echo "❌ Markets API failed"

echo ""
echo "🔍 4. SOL Price API..."
curl -s "$PROD_URL/api/markets/SOL-PERP/price" | jq '.' || echo "❌ SOL Price API failed"

echo ""
echo "✅ Production test complete!"
