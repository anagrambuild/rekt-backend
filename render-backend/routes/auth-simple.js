const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  validateCreateAccount,
  validateSignIn,
  validateUsername,
  validateEmail,
} = require("../middleware/validation");

const router = express.Router();

// Validate Solana public key format
const validateSolanaAddress = address => {
  if (!address || typeof address !== "string") {
    return { valid: false, message: "Wallet address is required" };
  }

  // Solana public keys are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(address)) {
    return { valid: false, message: "Invalid Solana wallet address format" };
  }

  return { valid: true };
};

// Generate username suggestions
const generateUsernameSuggestions = baseUsername => {
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
    console.error("❌ Username check error:", error);
    res.status(500).json({
      error: "Username check failed",
      message: "Unable to check username availability",
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
    const { username, email, avatar_url, wallet_address } = req.body;

    // Validate wallet address if provided
    if (wallet_address) {
      const walletValidation = validateSolanaAddress(wallet_address);
      if (!walletValidation.valid) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet address",
          message: walletValidation.message,
        });
      }
    }

    // Check if username already exists
    const { data: existingUser } = await req.supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already taken",
      });
    }

    // Check if email already exists
    const { data: existingEmail } = await req.supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .single();

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Check if wallet address already exists (if provided)
    if (wallet_address) {
      const { data: existingWallet } = await req.supabase
        .from("profiles")
        .select("wallet_address")
        .eq("wallet_address", wallet_address)
        .single();

      if (existingWallet) {
        return res.status(409).json({
          success: false,
          error: "Wallet address already exists",
          message:
            "The wallet address has already been created with an account",
        });
      }
    }

    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      avatar_url: avatar_url || null,
      wallet_address: wallet_address || null,
      swig_wallet_address:
        req.body.swigWalletAddress || `placeholder_${uuidv4().slice(0, 8)}`, // Unique placeholder until user connects wallet
      auth_method: "email", // Simple email auth method
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdUser, error } = await req.supabase
      .from("profiles")
      .insert([newUser])
      .select()
      .single();

    if (error) {
      console.error("❌ Database insert error:", error);
      throw error;
    }

    res.status(201).json({
      success: true,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        avatar_url: createdUser.avatar_url,
        wallet_address: createdUser.wallet_address,
        swig_wallet_address: createdUser.swig_wallet_address,
        joined_at: createdUser.joined_at,
      },
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("❌ Account creation error:", error);
    res.status(500).json({
      success: false,
      message: "Account creation failed",
      error: error.message,
    });
  }
});

module.exports = router;
