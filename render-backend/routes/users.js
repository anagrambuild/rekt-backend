const express = require("express");

const router = express.Router();

// GET /api/users/by-wallet/:walletAddress - Get user by wallet address
router.get("/by-wallet/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required",
        message: "Please provide a wallet address",
      });
    }

    const { data: user, error } = await req.supabase
      .from("profiles")
      .select(
        "id, username, email, avatar_url, wallet_address, swig_wallet_address, joined_at, updated_at"
      )
      .eq("wallet_address", walletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "No user found with this wallet address",
        });
      }
      throw error;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        wallet_address: user.wallet_address,
        swig_wallet_address: user.swig_wallet_address,
        joined_at: user.joined_at,
        updated_at: user.updated_at,
      },
      message: "User found successfully",
    });
  } catch (error) {
    console.error("❌ User lookup by wallet error:", error);
    res.status(500).json({
      success: false,
      error: "User lookup failed",
      message: "Unable to fetch user by wallet address",
    });
  }
});

// GET /api/users/profile/:id - Get user profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await req.supabase
      .from("profiles")
      .select(
        "id, username, email, avatar_url, swig_wallet_address, joined_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          error: "User not found",
          message: "User profile does not exist",
        });
      }
      throw error;
    }

    res.json({ user });
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({
      error: "Profile fetch failed",
      message: "Unable to fetch user profile",
    });
  }
});

// PUT /api/users/profile/:id - Update user profile
router.put("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, avatar_url } = req.body;

    // Build update object with only provided fields
    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (username) updates.username = username;
    if (email) updates.email = email;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: updatedUser, error } = await req.supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        joined_at: updatedUser.joined_at,
        updated_at: updatedUser.updated_at,
      },
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("❌ Profile update error:", error);
    res.status(500).json({
      success: false,
      error: "Profile update failed",
      message: "Unable to update profile",
    });
  }
});

module.exports = router;
