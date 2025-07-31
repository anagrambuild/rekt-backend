#!/usr/bin/env node

/**
 * Simple test to verify database lookup of Swig wallet address
 *
 * USAGE:
 * cd /Users/timk/projects/rekt-backend/render-backend
 * node test-db-lookup.js [profile-id]
 *
 * EXAMPLE:
 * node test-db-lookup.js 489aebd6-1cdf-4788-9872-6d022c33352c
 *
 * If no profile-id is provided, uses the default test profile ID
 */

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client (same as in trading service)
const supabaseUrl =
  process.env.SUPABASE_URL || "https://amgeuvathssbhopfvubw.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZ2V1dmF0aHNzYmhvcGZ2dWJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzUwNTQwMywiZXhwIjoyMDYzMDgxNDAzfQ.2kojQiE653EyG4OUVtufj7cEzU_SwMiUMvovGJwIp4E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseLookup(profileId) {
  console.log(`🔍 Testing database lookup for profile: ${profileId}\n`);

  try {
    // Test direct database query
    console.log("📋 Step 1: Direct database query");
    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, username, swig_wallet_address, created_at")
      .eq("id", profileId)
      .single();

    if (error) {
      console.error("❌ Database error:", error);
      return;
    }

    if (!user) {
      console.log("❌ User not found in database");
      return;
    }

    console.log("✅ User found in database:");
    console.log(`   🆔 ID: ${user.id}`);
    console.log(`   👤 Username: ${user.username || "N/A"}`);
    console.log(`   💳 Swig Wallet: ${user.swig_wallet_address || "N/A"}`);
    console.log(`   📅 Created: ${user.created_at}\n`);

    // Test wallet address validation
    console.log("📋 Step 2: Wallet address validation");
    if (!user.swig_wallet_address) {
      console.log("⚠️  No Swig wallet address found");
    } else if (user.swig_wallet_address.startsWith("placeholder_")) {
      console.log("⚠️  Swig wallet is a placeholder");
    } else if (user.swig_wallet_address.startsWith("temp_")) {
      console.log("⚠️  Swig wallet is temporary");
    } else {
      console.log("✅ Valid Swig wallet address found");
      console.log(`   🔑 Address: ${user.swig_wallet_address}`);
    }

    // Test recent trades for this user
    console.log("\n📋 Step 3: Check recent trades");
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id, asset, direction, status, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (tradesError) {
      console.error("❌ Error fetching trades:", tradesError);
    } else {
      console.log(`✅ Found ${trades.length} recent trades:`);
      trades.forEach((trade, index) => {
        console.log(
          `   ${index + 1}. ${trade.asset} ${trade.direction} (${
            trade.status
          }) - ${trade.created_at}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("📋 Full error:", error);
  }
}

// Get profile ID from command line
const profileId = process.argv[2] || "489aebd6-1cdf-4788-9872-6d022c33352c";

console.log("🧪 Database Lookup Test\n");
testDatabaseLookup(profileId);
