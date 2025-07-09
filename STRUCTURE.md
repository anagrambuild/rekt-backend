# Project Structure

## 📁 Clean File Organization

```
rekt-backend/
├── src/
│   └── server.js          # Main server (integrated Drift SDK + WebSocket + API)
├── public/
│   ├── index.html         # Frontend dashboard
│   ├── app.js            # JavaScript client with console capture
│   └── style.css         # Styling
├── examples/
│   └── frontend-integration.ts  # Example code
├── package.json          # Dependencies and scripts
├── README.md            # Setup and usage guide  
├── PROJECT_CONTEXT.md   # Project context and background
└── STRUCTURE.md         # This file
```

## 🧹 Cleaned Up (Removed)

❌ **Redundant Server Files:**
- `working-server.js` → Integrated into `src/server.js`
- `src/server_fix.js` → Obsolete 
- `src/services/driftService.js` → Integrated into main server
- `src/services/` → Directory removed

❌ **Development/Debug Files:**
- `server-end-fix.txt` → Temporary debugging file
- `simple-test.js` → Test file
- `test-setup.js` → Test setup file

## ⚡ Key Features

✅ **Unified Server** (`src/server.js`):
- Express HTTP server on port 3004
- WebSocket server for real-time data
- Integrated Drift SDK for trading
- Real USDC balance fetching
- Transaction creation and simulation
- Rate limiting and retry logic

✅ **Enhanced Frontend** (`public/app.js`):
- Phantom wallet integration
- Live console log capture
- Real-time price updates via WebSocket
- Transaction signing and submission
- Trade execution with proper error handling

✅ **Production Ready**:
- Clean package.json scripts
- Updated README with proper setup
- Consistent port configuration (3004)
- Proper static file serving

## 🚀 Usage

```bash
npm install
npm start
# Open http://localhost:3004
```

All functionality preserved while removing ~8 redundant files!
