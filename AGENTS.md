# AGENTS.md - Development Guidelines for REKT Backend

## Build/Test Commands

### Trading Backend (Current - Port 3004)

- `npm start` - Start production server on port 3004
- `npm run dev` - Start development server with auto-restart (nodemon)
- `node tests/run-tests.js` - Run full test suite (42 tests)
- `node tests/run-tests.js --health` - Server health check only
- `node tests/run-tests.js --utils-only` - Run utility tests only
- `node tests/run-tests.js --api-only` - Run API endpoint tests only
- `node tests/run-tests.js --drift-only` - Run Drift SDK integration tests only

### User Management Backend (New - Render/Port 3005)

- `cd render-backend && npm start` - Start user management server
- `cd render-backend && npm run dev` - Development with auto-restart
- `cd render-backend && npm test` - Run user management tests

## Code Style Guidelines

- **Imports**: Use CommonJS `require()` syntax, group by: Node.js built-ins, external packages, local modules
- **Formatting**: 2-space indentation, semicolons required, double quotes for strings
- **Variables**: Use `const` by default, `let` when reassignment needed, descriptive camelCase names
- **Functions**: Async/await preferred over promises, JSDoc comments for complex functions
- **Error Handling**: Always use try-catch blocks, structured error responses with debugging info
- **Logging**: Use descriptive console.log with emojis for visual categorization (📊 💡 ⚠️ ✅)
- **Constants**: Centralized in `src/constants.js`, ALL_CAPS naming convention
- **Comments**: Minimal inline comments, focus on WHY not WHAT, use JSDoc for function documentation

## User Onboarding System Architecture

### Two-Backend System

- **Trading Backend** (src/server.js, port 3004) - Drift SDK, WebSocket, trading operations
- **User Backend** (render-backend/, Render deployment) - Auth, profiles, avatar uploads
- **Database**: Supabase (amgeuvathssbhopfvubw) with existing `profiles` table schema
- **Frontend Flow**: auth.html → dashboard.html (renamed from index.html)

### Key Implementation Details

- **Auth Method**: Simple email lookup (no passwords, magic links upgrade path ready)
- **Validation**: Real-time username availability, email uniqueness, avatar <5MB
- **Environment Toggle**: Development (localhost:3005) vs Production (Render URL)
- **Session**: localStorage (JWT upgrade path ready)

### User Management API Endpoints

- `POST /api/auth/signin` - Email lookup authentication
- `POST /api/auth/create-account` - Username + email + avatar account creation
- `POST /api/auth/check-username` - Real-time username availability
- `POST /api/auth/check-email` - Email uniqueness validation
- `POST /api/users/upload-avatar` - Avatar upload to Supabase Storage

## MVP Trading System Migration (COMPLETED ✅)

### Production Deployment Status

- **Live URL**: https://rekt-user-management.onrender.com
- **Migration Status**: 100% Complete - All trading functionality moved from local backend (port 3004) to production Render backend
- **Database Integration**: Full Supabase integration with trade persistence and user statistics
- **Auto-deployment**: Working via GitHub push to main branch

### Critical Database Fix Applied

- **Issue**: PostgreSQL function `calculate_user_stats()` had variable scope bug causing trade insertion to hang
- **Solution**: Fixed variables `top_win_id`/`top_loss_id` scope in database trigger
- **Result**: Trade operations now work perfectly with real-time database updates

### Production API Endpoints (All Verified Working ✅)

#### Trading System APIs

- `GET /api/status` - Service health check
- `GET /api/markets` - Real-time SOL/BTC/ETH prices from Drift
- `GET /api/markets/{symbol}/price` - Individual market price data
- `GET /api/trading/balance/{userId}` - User trading balance (MVP mock data)
- `POST /api/trading/open` - Open new positions (stored in database)
- `GET /api/trading/positions/{userId}` - Get active positions with live PnL
- `GET /api/trading/history/{userId}` - Complete trading history with status filtering
- `POST /api/trading/close` - Close positions (database updated)
- `WebSocket /ws` - Real-time price updates and position monitoring

#### Authentication APIs (Existing)

- `POST /api/auth/signin` - Email lookup authentication
- `POST /api/auth/create-account` - Account creation with Swig wallet integration
- `POST /api/auth/check-username` - Username availability
- `POST /api/auth/check-email` - Email uniqueness validation

### Key Technical Achievements

#### 1. Swig Wallet Integration

- Integrated existing Swig wallet system with trading functionality
- User profiles now include `swig_wallet_address` for trading operations
- Seamless connection between authentication and trading systems

#### 2. Database Schema Implementation

```sql
-- trades table with full lifecycle tracking
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  asset TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  size DECIMAL NOT NULL,
  entry_price DECIMAL NOT NULL,
  exit_price DECIMAL,
  leverage INTEGER NOT NULL,
  margin_used DECIMAL NOT NULL,
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Auto-calculated user statistics
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  total_pnl DECIMAL DEFAULT 0,
  best_trade_pnl DECIMAL DEFAULT 0,
  worst_trade_pnl DECIMAL DEFAULT 0
);
```

#### 3. Real-time WebSocket Implementation

- Live price streaming every 5 seconds
- Position monitoring with automatic PnL calculations
- Client wallet registration and management
- Market data broadcasting to all connected clients

### Production Testing Results (100% Success ✅)

#### Endpoint Verification

```bash
# All endpoints tested and working:
✅ Health check: https://rekt-user-management.onrender.com/api/status
✅ Markets API: Real-time prices (SOL $176.84, BTC $117,437, ETH $3,757)
✅ Trading balance: Mock data for MVP
✅ Open position: Database storage working
✅ Get positions: Live PnL calculations
✅ Trading history: Status filtering functional
✅ Close position: Database updates working
✅ WebSocket: Real-time updates active
✅ Frontend: Static files serving correctly
```

#### Test Commands for Production

```bash
# Quick deployment verification
./test-existing-deployment.sh https://rekt-user-management.onrender.com

# Comprehensive endpoint testing
./test-prod-quick.sh
./test-prod-simple.sh

# Production endpoint testing (updated)
node test-production.js
```

### Architecture Migration Summary

#### Before (Broken Local System)

```
Frontend → Local Backend (port 3004) → Database (hanging operations)
```

#### After (Production System)

```
Frontend → Render Backend → Supabase Database (working perfectly)
    ↓           ↓              ↓
WebSocket → Trading Service → Trades Table
    ↓           ↓              ↓
Live Updates → Swig Wallets → User Stats (auto-calculated)
```

### File Structure Changes

```
render-backend/
├── services/trading.js     # Core trading logic with Swig integration
├── routes/trading.js       # Trading API endpoints
├── websocket/trading-ws.js # Real-time WebSocket server
├── server.js              # Static file serving + legacy compatibility
└── middleware/            # Validation and Supabase integration

public/                    # Frontend files now served from render-backend
├── auth.html             # Authentication page
├── dashboard.html        # Trading dashboard (renamed from index.html)
└── app.js               # Frontend with wallet integration
```

## Testing Requirements

### Production Testing (Updated)

- **Primary**: Use production testing scripts for verification
- **URL**: Always test against https://rekt-user-management.onrender.com
- **Database**: All operations now persist to Supabase with real-time updates
- **WebSocket**: Test real-time price feeds and position monitoring

### Legacy Testing (Original Backend)

- Always run full test suite after code changes: `node tests/run-tests.js`
- Verify 80%+ test pass rate before committing changes
- Test high-leverage trades (>20x) specifically after Drift SDK updates
- Monitor for InsufficientCollateral errors and buffer offset issues

### User Management Tests

- Test username/email validation endpoints
- Verify avatar upload/resize functionality
- Test auth flow integration with trading dashboard
- Validate Swig wallet integration with trading system
