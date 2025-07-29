const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

// Proxy to main server for markets data
router.get("/", async (req, res) => {
  try {
    console.log("📊 Markets request received - proxying to main server...");

    // Use environment variable for main server URL, fallback to localhost for development
    const mainServerUrl =
      process.env.MAIN_SERVER_URL || "http://localhost:3004";
    const marketsEndpoint = `${mainServerUrl}/api/markets`;

    console.log(`🔗 Proxying to: ${marketsEndpoint}`);

    const response = await fetch(marketsEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Main server responded with status: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Successfully proxied markets data from main server");

    res.json(data);
  } catch (error) {
    console.error("❌ Markets proxy error:", error.message);

    // Fallback response if main server is unavailable
    res.status(500).json({
      success: false,
      error: "Failed to fetch market data",
      message: error.message,
      fallback: true,
      data: [
        {
          symbol: "SOL-PERP",
          price: 160.0,
          volume24h: 2000000,
          change24h: 0.5,
          high24h: 162.0,
          low24h: 158.0,
          funding: 0.01,
          openInterest: 8000000,
        },
        {
          symbol: "BTC-PERP",
          price: 113000.0,
          volume24h: 50000000,
          change24h: 1.2,
          high24h: 114000.0,
          low24h: 112000.0,
          funding: 0.005,
          openInterest: 100000000,
        },
        {
          symbol: "ETH-PERP",
          price: 2800.0,
          volume24h: 20000000,
          change24h: -0.8,
          high24h: 2850.0,
          low24h: 2750.0,
          funding: 0.008,
          openInterest: 30000000,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
