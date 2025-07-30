const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const fetch = require("node-fetch");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth-simple");
const userRoutes = require("./routes/users");
const uploadRoutes = require("./routes/upload");
const marketRoutes = require("./routes/markets");
const tradingRoutes = require("./routes/trading");

// Import middleware
const supabaseMiddleware = require("./middleware/supabase");

// Import WebSocket server
const TradingWebSocketServer = require("./websocket/trading-ws");

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware with relaxed CSP for development
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per minute
  message: { error: "Too many requests, please try again later" },
});
app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute for auth
  message: {
    error: "Too many authentication attempts, please try again later",
  },
});

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3004",
    "http://localhost:3005",
    "http://localhost:8080",
    process.env.CORS_ORIGIN,
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from public directory
app.use(express.static("../public"));

// Initialize Supabase middleware
app.use(supabaseMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "rekt-user-management",
  });
});

// Root route - redirect to auth page
app.get("/", (req, res) => {
  res.redirect("/auth.html");
});

// API routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/trading", tradingRoutes);

// Legacy API endpoints for frontend compatibility
app.get("/api/status", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "rekt-trading-backend",
  });
});

app.get("/api/markets/:symbol/price", async (req, res) => {
  try {
    const { symbol } = req.params;
    // Redirect to our markets endpoint and extract the specific symbol
    const marketsResponse = await fetch(`http://localhost:${PORT}/api/markets`);
    const marketsData = await marketsResponse.json();

    if (marketsData.success) {
      const market = marketsData.data.find((m) => m.symbol === symbol);
      if (market) {
        res.json({
          success: true,
          data: { price: market.price },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({ error: "Market not found" });
      }
    } else {
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "rekt-user-management",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize WebSocket server
const tradingWS = new TradingWebSocketServer();

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 REKT Trading Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 CORS origins: ${corsOptions.origin.join(", ")}`);

  // Initialize WebSocket server
  try {
    await tradingWS.initialize(server);
    console.log(`🔌 WebSocket server initialized on ws://localhost:${PORT}/ws`);
  } catch (error) {
    console.error("❌ Failed to initialize WebSocket server:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  await tradingWS.cleanup();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  await tradingWS.cleanup();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

module.exports = app;
