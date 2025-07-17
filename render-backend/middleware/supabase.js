const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl =
  process.env.SUPABASE_URL || "https://amgeuvathssbhopfvubw.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZ2V1dmF0aHNzYmhvcGZ2dWJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzUwNTQwMywiZXhwIjoyMDYzMDgxNDAzfQ.2kojQiE653EyG4OUVtufj7cEzU_SwMiUMvovGJwIp4E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware to attach Supabase client to request object
const supabaseMiddleware = (req, res, next) => {
  req.supabase = supabase;
  next();
};

module.exports = supabaseMiddleware;
