const { WebSocketServer } = require("ws");
const {
  createConnection,
  createDriftClient,
  cleanupDriftClient,
  PRICE_PRECISION,
} = require("../utils");
const { SUPPORTED_MARKETS, WEBSOCKET_CONFIG } = require("../constants");
const TradingService = require("../services/trading");

class TradingWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map of userId -> WebSocket connections
    this.priceUpdateInterval = null;
    this.positionUpdateInterval = null;
    this.driftClient = null;
    this.connection = null;
    this.tradingService = new TradingService();
    this.lastPrices = {}; // Cache last known prices
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(server) {
    try {
      console.log("🔌 Initializing Trading WebSocket Server...");

      // Create WebSocket server
      this.wss = new WebSocketServer({
        server,
        path: "/ws",
      });

      // Set up connection handling
      this.wss.on("connection", (ws, req) => {
        this.handleConnection(ws, req);
      });

      // Initialize Drift client for price updates (non-blocking)
      this.initializeDriftClient().catch((error) => {
        console.warn(
          "⚠️ Drift client initialization failed, using fallback prices:",
          error.message
        );
      });

      // Start price update intervals
      this.startPriceUpdates();

      console.log("✅ Trading WebSocket Server initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing WebSocket server:", error);
      throw error;
    }
  }

  /**
   * Initialize Drift client for market data
   */
  async initializeDriftClient() {
    try {
      console.log("🔄 Initializing Drift client for WebSocket...");

      this.connection = await createConnection();

      // Use a dummy wallet for read-only operations
      const dummyWallet = "11111111111111111111111111111111";
      this.driftClient = await createDriftClient(this.connection, dummyWallet);

      console.log("✅ Drift client initialized for WebSocket");
    } catch (error) {
      console.error("❌ Error initializing Drift client:", error);
      // Continue without Drift client - use fallback prices
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    console.log("🔗 New WebSocket connection established");

    // Parse URL to get user ID if provided
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");

    if (userId) {
      // Store connection with user ID
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);
      console.log(`👤 User ${userId} connected to WebSocket`);
    }

    // Send initial data
    this.sendInitialData(ws);

    // Handle messages
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message, userId);
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      if (userId && this.clients.has(userId)) {
        this.clients.get(userId).delete(ws);
        if (this.clients.get(userId).size === 0) {
          this.clients.delete(userId);
        }
        console.log(`👤 User ${userId} disconnected from WebSocket`);
      } else {
        console.log("🔗 WebSocket connection closed");
      }
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
    });
  }

  /**
   * Send initial data to new connection
   */
  async sendInitialData(ws) {
    try {
      // Send current prices if available
      if (Object.keys(this.lastPrices).length > 0) {
        this.sendMessage(ws, {
          type: "prices",
          data: this.lastPrices,
          timestamp: new Date().toISOString(),
        });
      }

      // Send welcome message
      this.sendMessage(ws, {
        type: "connected",
        message: "Connected to REKT Trading WebSocket",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error sending initial data:", error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws, message, userId) {
    try {
      console.log(`📨 WebSocket message received:`, message.type);

      switch (message.type) {
        case "subscribe_prices":
          // Client wants to subscribe to price updates
          this.sendMessage(ws, {
            type: "subscribed",
            subscription: "prices",
            timestamp: new Date().toISOString(),
          });
          break;

        case "subscribe_positions":
          // Client wants to subscribe to position updates
          if (userId) {
            this.sendMessage(ws, {
              type: "subscribed",
              subscription: "positions",
              userId,
              timestamp: new Date().toISOString(),
            });
            // Send current positions
            await this.sendPositionUpdate(userId);
          }
          break;

        case "ping":
          // Heartbeat
          this.sendMessage(ws, {
            type: "pong",
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("❌ Error handling WebSocket message:", error);
    }
  }

  /**
   * Send message to WebSocket client
   */
  sendMessage(ws, message) {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error("❌ Error sending WebSocket message:", error);
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message) {
    this.wss.clients.forEach((ws) => {
      this.sendMessage(ws, message);
    });
  }

  /**
   * Send message to specific user's connections
   */
  sendToUser(userId, message) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).forEach((ws) => {
        this.sendMessage(ws, message);
      });
    }
  }

  /**
   * Start price update intervals
   */
  startPriceUpdates() {
    console.log("📊 Starting price update intervals...");

    // Price updates every 5 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.updatePrices();
    }, WEBSOCKET_CONFIG.PRICE_UPDATE_INTERVAL);

    // Position updates every 10 seconds
    this.positionUpdateInterval = setInterval(async () => {
      await this.updateAllPositions();
    }, WEBSOCKET_CONFIG.POSITION_UPDATE_INTERVAL * 2); // Less frequent for positions
  }

  /**
   * Update market prices and broadcast
   */
  async updatePrices() {
    try {
      const prices = {};

      if (this.driftClient) {
        // Get real prices from Drift
        for (const [symbol, marketIndex] of Object.entries(SUPPORTED_MARKETS)) {
          try {
            const oracleData =
              await this.driftClient.getOracleDataForPerpMarket(marketIndex);
            const price =
              oracleData.price.toNumber() / PRICE_PRECISION.toNumber();
            prices[symbol] = parseFloat(price.toFixed(2));
          } catch (error) {
            // Use last known price or fallback
            if (this.lastPrices[symbol]) {
              prices[symbol] = this.lastPrices[symbol];
            } else {
              // Fallback prices
              prices[symbol] =
                symbol === "SOL-PERP"
                  ? 160
                  : symbol === "BTC-PERP"
                  ? 113000
                  : 2800;
            }
          }
        }
      } else {
        // Use fallback prices if no Drift client
        prices["SOL-PERP"] = 160 + (Math.random() - 0.5) * 2; // Small random variation
        prices["BTC-PERP"] = 113000 + (Math.random() - 0.5) * 1000;
        prices["ETH-PERP"] = 2800 + (Math.random() - 0.5) * 50;
      }

      // Update cache
      this.lastPrices = prices;

      // Broadcast to all clients
      this.broadcast({
        type: "prices",
        data: prices,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error updating prices:", error);
    }
  }

  /**
   * Update positions for all connected users
   */
  async updateAllPositions() {
    try {
      // Update positions for each connected user
      for (const userId of this.clients.keys()) {
        await this.sendPositionUpdate(userId);
      }
    } catch (error) {
      console.error("❌ Error updating positions:", error);
    }
  }

  /**
   * Send position update to specific user
   */
  async sendPositionUpdate(userId) {
    try {
      const positions = await this.tradingService.getPositions(userId);

      this.sendToUser(userId, {
        type: "positions",
        data: positions,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `❌ Error sending position update for user ${userId}:`,
        error
      );
    }
  }

  /**
   * Notify about new position
   */
  async notifyPositionOpened(userId, position) {
    this.sendToUser(userId, {
      type: "position_opened",
      data: position,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify about closed position
   */
  async notifyPositionClosed(userId, position) {
    this.sendToUser(userId, {
      type: "position_closed",
      data: position,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stop all intervals and cleanup
   */
  async cleanup() {
    console.log("🧹 Cleaning up Trading WebSocket Server...");

    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
    }

    if (this.driftClient) {
      await cleanupDriftClient(this.driftClient);
    }

    if (this.wss) {
      this.wss.close();
    }

    console.log("✅ Trading WebSocket Server cleanup complete");
  }
}

module.exports = TradingWebSocketServer;
