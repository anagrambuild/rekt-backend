#!/bin/bash

echo "🚀 Setting up REKT Backend..."

# Create .env file from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file - please edit it with your configuration"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start MongoDB (if using local instance)"
echo "3. Run 'npm run dev' to start development server"
echo "4. The API will be available at http://localhost:3001"
echo ""
echo "API Endpoints:"
echo "- GET /health - Health check"
echo "- GET /api/v1/markets - Get all markets"
echo "- GET /api/v1/markets/:symbol/price - Get market price"
echo "- GET /api/v1/markets/positions/:wallet - Get user positions"
echo "- POST /api/v1/markets/orders - Place an order"
echo ""
echo "WebSocket URL: ws://localhost:3001"
