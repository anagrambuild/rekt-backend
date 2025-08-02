const express = require("express");
const {
  asyncHandler,
  createErrorResponse,
  createSuccessResponse,
} = require("../utils");
const TradingService = require("../services/trading");

const router = express.Router();

// Initialize trading service
const tradingService = new TradingService();

// POST /api/trading/open - Open a new position (returns transaction data for signing)
router.post(
  "/open",
  asyncHandler(async (req, res) => {
    try {
      const { userId, asset, direction, amount, leverage } = req.body;

      // Basic validation
      if (!userId || !asset || !direction || !amount || !leverage) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing required fields"),
              "userId, asset, direction, amount, and leverage are required",
              400
            )
          );
      }

      // Validate leverage range
      if (leverage < 1 || leverage > 100) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid leverage"),
              "Leverage must be between 1 and 100",
              400
            )
          );
      }

      // Validate direction
      if (!["long", "short"].includes(direction.toLowerCase())) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid direction"),
              "Direction must be 'long' or 'short'",
              400
            )
          );
      }

      // Validate asset
      const validAssets = ["SOL-PERP", "BTC-PERP", "ETH-PERP"];
      if (!validAssets.includes(asset)) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid asset"),
              `Asset must be one of: ${validAssets.join(", ")}`,
              400
            )
          );
      }

      // Validate amount
      if (amount < 10) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid amount"),
              "Minimum trade amount is $10",
              400
            )
          );
      }

      console.log(
        `🚀 Opening position: ${direction} ${asset} with ${leverage}x leverage, amount: $${amount}`
      );

      // Open position using trading service (returns transaction data)
      const result = await tradingService.openPosition(
        userId,
        asset,
        direction,
        amount,
        leverage
      );

      if (result.needsInitialization || result.initializationRequired) {
        // User needs to initialize Drift account first
        return res.json(
          createSuccessResponse(result, "Drift account initialization required")
        );
      }

      res.json(
        createSuccessResponse(
          result,
          "Position transaction created successfully"
        )
      );
    } catch (error) {
      console.error("❌ Error opening position:", error);
      res
        .status(500)
        .json(
          createErrorResponse(
            error,
            "Failed to create position transaction",
            500
          )
        );
    }
  })
);

// GET /api/trading/positions/:userId - Get user's positions
router.get(
  "/positions/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(`📊 Fetching positions for user: ${userId}`);

      // Get positions using trading service
      const positions = await tradingService.getPositions(userId);

      res.json(
        createSuccessResponse(positions, "Positions retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching positions:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to fetch positions", 500));
    }
  })
);

// GET /api/trading/history/:userId - Get user's complete trading history
router.get(
  "/history/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.query; // Optional filter: ?status=open or ?status=closed

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(
        `📚 Fetching trading history for user: ${userId}, status filter: ${
          status || "all"
        }`
      );

      // Get trading history using trading service
      const history = await tradingService.getTradingHistory(userId, status);

      res.json(
        createSuccessResponse(history, "Trading history retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching trading history:", error);
      res
        .status(500)
        .json(
          createErrorResponse(error, "Failed to fetch trading history", 500)
        );
    }
  })
);

// POST /api/trading/close - Close a position (returns transaction data for signing)
router.post(
  "/close",
  asyncHandler(async (req, res) => {
    try {
      const { userId, positionId } = req.body;

      if (!userId || !positionId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing required fields"),
              "userId and positionId are required",
              400
            )
          );
      }

      console.log(`🔒 Closing position: ${positionId} for user: ${userId}`);

      // Close position using trading service (returns transaction data)
      const result = await tradingService.closePosition(userId, positionId);

      res.json(
        createSuccessResponse(
          result,
          "Position close transaction created successfully"
        )
      );
    } catch (error) {
      console.error("❌ Error closing position:", error);
      res
        .status(500)
        .json(
          createErrorResponse(
            error,
            "Failed to create close position transaction",
            500
          )
        );
    }
  })
);

// GET /api/trading/balance/:userId - Get user's balance
router.get(
  "/balance/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(`💰 Fetching balance for user: ${userId}`);

      // Get balance using trading service
      const balance = await tradingService.getBalance(userId);

      res.json(
        createSuccessResponse(balance, "Balance retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching balance:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to fetch balance", 500));
    }
  })
);

// POST /api/trading/confirm-transaction - Confirm a transaction was successful
router.post(
  "/confirm-transaction",
  asyncHandler(async (req, res) => {
    try {
      const { userId, positionId, transactionId, type } = req.body;

      if (!userId || !positionId || !transactionId || !type) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing required fields"),
              "userId, positionId, transactionId, and type are required",
              400
            )
          );
      }

      console.log(
        `✅ Confirming ${type} transaction: ${transactionId} for position: ${positionId}`
      );

      // Update trade status based on transaction type
      let updateData = {};

      if (type === "open") {
        updateData = {
          status: "open",
          transaction_id: transactionId,
          opened_at: new Date().toISOString(),
        };
      } else if (type === "close") {
        updateData = {
          status: "closed",
          close_transaction_id: transactionId,
          exit_time: new Date().toISOString(),
        };
      }

      // Update trade in database
      const { error } = await req.supabase
        .from("trades")
        .update(updateData)
        .eq("id", positionId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to update trade: ${error.message}`);
      }

      console.log(`✅ Transaction confirmed and trade updated: ${positionId}`);

      res.json(
        createSuccessResponse(
          { positionId, transactionId, type, status: "confirmed" },
          "Transaction confirmed successfully"
        )
      );
    } catch (error) {
      console.error("❌ Error confirming transaction:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to confirm transaction", 500));
    }
  })
);

// POST /api/trading/submit - Submit signed transaction to blockchain
router.post(
  "/submit",
  asyncHandler(async (req, res) => {
    try {
      const { signedTransaction, walletAddress, positionId } = req.body;

      if (!signedTransaction) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing signed transaction data"),
              "signedTransaction is required",
              400
            )
          );
      }

      console.log(
        `📤 Submitting signed transaction for wallet: ${walletAddress}`
      );

      try {
        // Convert base64 back to buffer
        const txBuffer = Buffer.from(signedTransaction, "base64");

        // Create connection
        const { createConnection } = require("../utils");
        const connection = await createConnection();

        // Send the raw transaction directly
        console.log("📤 Sending raw transaction to Solana network...");
        const signature = await connection.sendRawTransaction(txBuffer, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });

        console.log("✅ Transaction submitted, signature:", signature);

        // Wait for confirmation
        console.log("⏳ Waiting for transaction confirmation...");
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash: null,
          commitment: "confirmed",
          maxRetries: 3,
        });

        console.log("🎉 Transaction confirmed:", confirmation);

        // Update trade record with real transaction ID if positionId provided
        if (positionId) {
          await req.supabase
            .from("trades")
            .update({
              transaction_id: signature,
              status: "open",
            })
            .eq("id", positionId);

          console.log(
            `✅ Updated trade record ${positionId} with transaction ${signature}`
          );
        }

        res.json(
          createSuccessResponse(
            {
              signature,
              confirmation: {
                slot: confirmation.context.slot,
                confirmations: null,
                confirmationStatus: "confirmed",
                err: null,
              },
            },
            "Transaction submitted and confirmed successfully"
          )
        );
      } catch (txError) {
        console.error("❌ Transaction submission error:", txError);
        res
          .status(500)
          .json(
            createErrorResponse(txError, "Failed to submit transaction", 500)
          );
      }
    } catch (error) {
      console.error("❌ Error in transaction submission handler:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Internal server error", 500));
    }
  })
);

module.exports = router;
