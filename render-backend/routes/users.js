const express = require("express");

const router = express.Router();

// GET /api/users/profile/:id - Get user profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await req.supabase
      .from("profiles")
      .select("id, username, email, avatar_url, joined_at, updated_at")
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
