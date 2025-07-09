# REKT Drift Trading Dashboard

A real-time trading dashboard for Drift Protocol with live WebSocket data, Phantom wallet integration, and on-chain trade execution.

## Features

- **🎯 Real Drift Trading**: Execute actual leveraged trades on SOL-PERP market
- **💰 Wallet Integration**: Phantom wallet connection with real USDC balance fetching
- **📊 Live Market Data**: WebSocket price feeds with 5-second updates
- **🔗 Transaction Management**: Full transaction creation, simulation, signing, and confirmation
- **📋 Console Logging**: Live backend console logs visible in frontend
- **🔒 Rate Limiting**: Built-in RPC rate limiting and retry logic

## Prerequisites

- Node.js 18+ 
- Solana mainnet RPC endpoint 
- Phantom wallet browser extension

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

3. **Open Dashboard**
   - Navigate to: `http://localhost:3004`
   - Connect your Phantom wallet
   - Start trading on Drift Protocol!

## Features Overview

### 🎯 **Trading**
- Real SOL-PERP perpetual futures trading
- Market orders with proper lot sizing
- Isolated margin (1x leverage)
- Live transaction simulation

### 💰 **Wallet Integration** 
- Phantom wallet connection
- Real USDC balance fetching
- Transaction signing and submission

### 📊 **Live Data**
- WebSocket price feeds (5s updates)
- Real oracle price fetching from Drift
- Live console logs in frontend

## API Endpoints

### Core Trading
- `GET /api/markets` - Get market data (SOL-PERP, ETH-PERP)
- `GET /api/wallet/:address/usdc-balance` - Get real USDC balance
- `POST /api/trade/submit` - Create Drift order transaction
- `POST /api/transaction/submit` - Submit signed transaction

### WebSocket (ws://localhost:3004)
- Real-time SOL price updates every 5 seconds
- Market data broadcasting to all connected clients
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { channel: 'price', symbol: 'SOL-PERP' }
}));
```

## Frontend Integration

### React Native/Expo Integration

1. **Install dependencies in your frontend**
   ```bash
   npm install @react-native-async-storage/async-storage
   ```

2. **API Service Example**
   ```typescript
   // services/api.ts
   const API_BASE_URL = 'http://localhost:3001/api/v1';
   
   export const fetchMarkets = async () => {
     const response = await fetch(`${API_BASE_URL}/markets`);
     return response.json();
   };
   
   export const fetchUserPositions = async (wallet: string) => {
     const response = await fetch(`${API_BASE_URL}/markets/positions/${wallet}`);
     return response.json();
   };
   ```

3. **WebSocket Integration**
   ```typescript
   // services/websocket.ts
   import { useEffect, useState } from 'react';
   
   export const useWebSocket = (url: string) => {
     const [ws, setWs] = useState<WebSocket | null>(null);
     const [prices, setPrices] = useState<Record<string, number>>({});
     
     useEffect(() => {
       const websocket = new WebSocket(url);
       
       websocket.onmessage = (event) => {
         const data = JSON.parse(event.data);
         if (data.type === 'price_update') {
           setPrices(prev => ({
             ...prev,
             [data.data.symbol]: data.data.price
           }));
         }
       };
       
       setWs(websocket);
       
       return () => websocket.close();
     }, [url]);
     
     return { ws, prices };
   };
   ```

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## 📁 Project Structure

```
rekt-backend/
├── src/
│   └── server.js          # Express server
├── public/
│   ├── index.html         # Web interface
│   ├── styles.css         # Styling
│   └── app.js             # Frontend JavaScript
├── package.json
├── .env.example
└── README.md
```

## 🚀 Development

This is designed as a simple development tool. To extend functionality:

1. **Add Drift SDK Integration**: Update `src/server.js` to include actual Drift SDK calls
2. **Enhance UI**: Modify `public/` files to add more features
3. **Add Authentication**: Implement wallet connection for transaction signing
4. **Real-time Updates**: Connect to Drift's WebSocket feeds for live data

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `SOLANA_RPC_URL`: Solana RPC endpoint
- `DRIFT_ENV`: Drift environment (mainnet-beta/devnet)

### Web Interface Configuration
- Configure directly in the web interface
- Settings are saved to localStorage
- Switch between mainnet and devnet easily

## 🎯 Use Cases

Perfect for:
- **API Exploration**: Test Drift Protocol endpoints
- **Development**: Prototype trading features
- **Learning**: Understand Solana and Drift integration
- **Testing**: Validate market data and WebSocket connections

## 🔒 Security Note

This is a development tool. For production use:
- Add proper authentication
- Implement rate limiting
- Use environment variables for sensitive data
- Add input validation and sanitization

## 📈 Next Steps

1. **Integrate Real Drift SDK**: Replace mock data with actual API calls
2. **Add Wallet Connection**: Implement browser wallet integration
3. **Enhance UI**: Add charts, order books, and trading interfaces
4. **Add More Markets**: Support additional perpetual markets
5. **Real-time Features**: Connect to live Drift data streams

---

**Built for Drift Protocol API Testing**  
Version: 1.0.0  
Last Updated: July 8, 2025
