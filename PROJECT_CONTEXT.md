# REKT Drift Trading Dashboard - Project Context

A complete real-time trading dashboard for Drift Protocol with integrated Phantom wallet support and on-chain trade execution. simple web application designed for testing and interacting with Drift Protocol APIs. This is a development tool that provides a clean web interface for exploring Drift's perpetuals trading infrastructure on Solana.

### Core Mission
- Provide a simple web interface for testing Drift Protocol APIs
- Enable rapid prototyping and development of Drift integrations
- Offer real-time data visualization and WebSocket testing
- Serve as a learning tool for Solana and Drift Protocol development

## 📋 Technical Requirements

### Primary Integration
- **Drift Protocol**: Full integration with Drift's V2 API for perpetuals trading
- **Solana Network**: Native Solana blockchain integration for wallet operations
- **Real-time Data**: WebSocket connections for live market data and order updates
- **Mobile-First**: Optimized for React Native/Expo frontend consumption

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB for user data and trade history
- **WebSocket**: Native WebSocket support for real-time features
- **Security**: JWT authentication, rate limiting, input validation
- **Deployment**: Docker-ready for cloud deployment

## 🔗 Key Resources & Documentation

### Drift Protocol Resources
- **Authentication Guide**: https://drift-labs.github.io/v2-teacher/#authentication
- **API Playground**: https://data.api.drift.trade/playground
- **SDK Documentation**: https://drift-labs.github.io/v2-teacher/
- **GitHub Repository**: https://github.com/drift-labs/protocol-v2
- **Discord Community**: https://discord.gg/driftprotocol

### Solana Development Resources
- **Solana Docs**: https://docs.solana.com/
- **Web3.js Documentation**: https://solana-labs.github.io/solana-web3.js/
- **Anchor Framework**: https://project-serum.github.io/anchor/

### Additional Resources
- **Drift Markets Data**: https://app.drift.trade/
- **Solana Explorer**: https://explorer.solana.com/
- **Drift Trading Interface**: https://app.drift.trade/

## 🏗 Architecture Decisions

### Separation of Concerns
- **Backend Location**: `/Users/liamdig/Desktop/sandbox/rekt-backend/`
- **Frontend Location**: `/Users/liamdig/Desktop/sandbox/rekt-react-native/`
- **Port Strategy**: Backend on 3001, Frontend on 8081 (Expo default)
- **Database**: MongoDB for user state, Drift Protocol for market data

### Integration Strategy
- **Read-Only Market Data**: Direct Drift SDK integration for market information
- **User Operations**: Wallet-based authentication with transaction signing
- **Real-time Updates**: WebSocket server for price feeds and order status
- **Error Handling**: Comprehensive error handling for blockchain operations

## 🚀 Implementation Status

### ✅ Completed Features
- [x] Express.js server with TypeScript setup
- [x] Drift Protocol SDK integration skeleton
- [x] WebSocket server for real-time data
- [x] MongoDB models for users and trades
- [x] RESTful API endpoints for markets and positions
- [x] Security middleware (CORS, helmet, rate limiting)
- [x] Input validation with Zod schemas
- [x] Development environment configuration
- [x] Frontend integration examples

### 🔄 In Progress
- [ ] Drift Protocol authentication implementation
- [ ] Wallet connection and transaction signing
- [ ] Order placement and management
- [ ] Historical data aggregation
- [ ] User session management

### 📋 Upcoming Requirements
- [ ] Production deployment configuration
- [ ] Monitoring and logging implementation
- [ ] Error reporting and alerting
- [ ] Performance optimization
- [ ] Load testing and scaling
- [ ] Security audit and penetration testing

## 🔐 Security Considerations

### Wallet Security
- **Private Key Management**: Never store private keys on server
- **Transaction Signing**: Client-side signing with server verification
- **Wallet Connection**: Support for popular Solana wallets (Phantom, Solflare, etc.)

### API Security
- **Rate Limiting**: Implemented per-IP rate limiting
- **Input Validation**: Comprehensive validation using Zod schemas
- **CORS Configuration**: Strict CORS policies for production
- **Authentication**: JWT-based session management

### Drift-Specific Security
- **API Key Management**: Secure storage of Drift API credentials
- **Transaction Verification**: Verify all transactions before processing
- **Market Data Integrity**: Validate market data from multiple sources

## 📊 Key API Endpoints

### Market Data
- `GET /api/v1/markets` - List all available perpetual markets
- `GET /api/v1/markets/:symbol/price` - Get current market price
- `GET /api/v1/markets/:symbol/orderbook` - Get order book data
- `GET /api/v1/markets/:symbol/trades` - Get recent trade history

### User Operations
- `GET /api/v1/markets/positions/:wallet` - Get user's open positions
- `POST /api/v1/markets/orders` - Place a new order
- `GET /api/v1/markets/orders/:wallet` - Get user's order history
- `DELETE /api/v1/markets/orders/:orderId` - Cancel an order

### WebSocket Events
- `price_update` - Real-time price changes
- `order_update` - Order status changes
- `position_update` - Position changes
- `market_update` - Market status changes

## 🛠 Development Workflow

### Environment Setup
```bash
# Navigate to backend directory
cd rekt-backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
# - SOLANA_RPC_URL: Your Solana RPC endpoint
# - DRIFT_ENV: mainnet-beta or devnet
# - MONGODB_URI: Your MongoDB connection string
```

### Running Development Server
```bash
# Start development server with hot reload
npm run dev

# Test API endpoints
curl http://localhost:3001/health

# Test WebSocket connection
node test-setup.js
```

### Building for Production
```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## 🧪 Testing Strategy

### Unit Tests
- Service layer testing for Drift integration
- API endpoint testing
- WebSocket connection testing
- Database model validation

### Integration Tests
- End-to-end API testing
- Drift Protocol integration testing
- WebSocket real-time data testing
- Error handling validation

### Performance Tests
- Load testing for concurrent users
- WebSocket connection scaling
- Database query optimization
- Memory usage monitoring

## 🚀 Deployment Considerations

### Cloud Deployment
- **Recommended Platforms**: AWS ECS, Google Cloud Run, or DigitalOcean
- **Database**: MongoDB Atlas for managed database
- **Monitoring**: CloudWatch, Datadog, or New Relic
- **Load Balancing**: Application Load Balancer for high availability

### Environment Variables
- `NODE_ENV`: production
- `PORT`: 3001 (or cloud provider assigned)
- `MONGODB_URI`: Production MongoDB connection
- `SOLANA_RPC_URL`: Production Solana RPC endpoint
- `DRIFT_ENV`: mainnet-beta
- `JWT_SECRET`: Secure random secret for production

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## 📈 Performance Targets

### Response Times
- API endpoints: < 200ms average response time
- WebSocket latency: < 50ms for price updates
- Database queries: < 100ms for user operations
- Drift API calls: < 500ms (dependent on network)

### Scalability
- Support 1000+ concurrent WebSocket connections
- Handle 10,000+ API requests per minute
- Database: Support 100,000+ users
- Real-time data: Process 1000+ market updates per second

## 🔄 Integration Points

### Frontend Integration
- **API Base URL**: `http://localhost:3001/api/v1`
- **WebSocket URL**: `ws://localhost:3001`
- **Authentication**: JWT tokens in Authorization header
- **Error Handling**: Consistent error response format

### Drift Protocol Integration
- **SDK Version**: Latest @drift-labs/sdk
- **Network**: Configurable mainnet-beta/devnet
- **Authentication**: Program derived addresses
- **Market Data**: Real-time via Drift's WebSocket feeds

### Database Schema
- **Users**: Wallet addresses, settings, trading history
- **Trades**: Order history, position tracking, PnL calculation
- **Markets**: Cached market data, price history
- **Sessions**: User authentication and session management

## 🎯 Success Metrics

### Technical Metrics
- 99.9% uptime for API endpoints
- < 1s average response time for all operations
- Zero data loss for user transactions
- 100% transaction integrity with blockchain

### Business Metrics
- Support high-frequency trading operations
- Seamless mobile user experience
- Comprehensive market data coverage
- Reliable order execution and settlement

## 📞 Support & Maintenance

### Monitoring
- Application performance monitoring
- Database query monitoring
- WebSocket connection monitoring
- Drift Protocol API monitoring

### Logging
- Structured logging with Winston
- Error tracking with Sentry
- Performance metrics with Prometheus
- User activity tracking

### Maintenance
- Regular dependency updates
- Security patches
- Performance optimization
- Database maintenance and backups

---

## 🔮 Future Enhancements

### Advanced Features
- Portfolio analytics and reporting
- Advanced order types (stop-loss, take-profit)
- Social trading features
- Risk management tools

### Technical Improvements
- GraphQL API implementation
- Microservices architecture
- Event-driven architecture
- Machine learning for price prediction

### Integration Expansions
- Additional DEX integrations
- Cross-chain trading support
- Automated trading strategies
- Third-party data providers

---

**Last Updated**: July 8, 2025  
**Version**: 1.0.0  
**Maintainer**: REKT Development Team  
**Status**: Development Phase
