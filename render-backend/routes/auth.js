const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  validateCreateAccount,
  validateSignIn,
  validateUsername,
  validateEmail,
} = require("../middleware/validation");

const router = express.Router();

// Test endpoint to verify Supabase connection
router.get("/test-db", async (req, res) => {
  try {
    const { data, error, count } = await req.supabase
      .from("profiles")
      .select("*", { count: "exact" });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Database connection working",
      count,
      recordCount: data?.length,
    });
  } catch (error) {
    console.error("❌ Database test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test insert endpoint
router.post("/test-insert", async (req, res) => {
  try {
    const testData = {
      id: uuidv4(),
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      auth_method: "email",
      swig_wallet_address: `temp_test_${Date.now()}`,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("🧪 Testing insert with data:", testData);

    const { data, error } = await req.supabase
      .from("profiles")
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error("❌ Insert test error:", error);
      throw error;
    }

    console.log("✅ Insert test successful:", data);
    res.json({ success: true, message: "Insert test successful", data });
  } catch (error) {
    console.error("❌ Database test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test insert endpoint
router.post("/test-insert", async (req, res) => {
  try {
    const testData = {
      id: uuidv4(),
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      auth_method: "email",
      swig_wallet_address: `temp_test_${Date.now()}`,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("🧪 Testing insert with data:", testData);

    const { data, error } = await req.supabase
      .from("profiles")
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error("❌ Insert test error:", error);
      throw error;
    }

    console.log("✅ Insert test successful:", data);
    res.json({ success: true, message: "Insert test successful", data });
  } catch (error) {
    console.error("❌ Insert test failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate username suggestions
const generateUsernameSuggestions = (baseUsername) => {
  const suggestions = [];
  const currentYear = new Date().getFullYear();

  suggestions.push(`${baseUsername}${Math.floor(Math.random() * 100)}`);
  suggestions.push(`${baseUsername}_${currentYear}`);
  suggestions.push(`${baseUsername}_${Math.floor(Math.random() * 1000)}`);

  return suggestions.slice(0, 3);
};

// POST /api/auth/check-username - Check username availability
router.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body;

    // Validate username format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid username",
        message: validation.message,
        available: false,
      });
    }

    // Check if username exists in database
    const { data, error } = await req.supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw error;
    }

    const available = !data;
    const response = { available };

    // If not available, provide suggestions
    if (!available) {
      response.suggestions = generateUsernameSuggestions(username);
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Account creation error:", error);
    res.status(500).json({
      success: false,
      message: "Account creation failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/auth/check-email - Check email existence
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    const validation = validateEmail(email);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid email",
        message: validation.message,
        exists: false,
      });
    }

    // Check if email exists in database
    const { data, error } = await req.supabase
      .from("profiles")
      .select("id, username, email, avatar_url")
      .eq("email", email)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const exists = !!data;
    const response = { exists };

    // If exists, return user info (for sign in)
    if (exists) {
      response.user = data;
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Email check error:", error);
    res.status(500).json({
      error: "Email check failed",
      message: "Unable to check email",
    });
  }
});

// POST /api/auth/signin - Sign in with email
router.post("/signin", validateSignIn, async (req, res) => {
  try {
    const { email } = req.body;

    // Look up user by email
    const { data: user, error } = await req.supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Email not found. Would you like to create an account?",
        });
      }
      throw error;
    }

    // Update last login time
    await req.supabase
      .from("profiles")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        joined_at: user.joined_at,
      },
      message: "Sign in successful",
    });
  } catch (error) {
    console.error("❌ Sign in error:", error);
    res.status(500).json({
      success: false,
      message: "Sign in failed",
    });
  }
});

// POST /api/auth/create-account - Create new account
router.post("/create-account", validateCreateAccount, async (req, res) => {
  try {
    const { username, email, avatar_url } = req.body;

    // Double-check username availability
    const { data: existingUsername } = await req.supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: "Username taken",
        message: "Username is already taken",
        suggestions: generateUsernameSuggestions(username),
      });
    }

    // Double-check email uniqueness
    const { data: existingEmail } = await req.supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .single();

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: "Email exists",
        message: "Email already exists. Sign in instead?",
      });
    }

    // Create new profile
    const profileData = {
      id: uuidv4(),
      username,
      email,
      avatar_url: avatar_url || null,
      auth_method: "email",
      swig_wallet_address: `temp_${username}_${Date.now()}`, // Temporary unique value
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("📝 Creating profile with data:", profileData);

    const { data: newUser, error } = await req.supabase
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      throw error;
    }

    console.log("✅ Profile created successfully:", newUser);

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar_url: newUser.avatar_url,
        joined_at: newUser.joined_at,
      },
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("❌ Account creation error:", error);
    res.status(500).json({
      success: false,
      message: "Account creation failed",
    });
  }
});

module.exports = router;
