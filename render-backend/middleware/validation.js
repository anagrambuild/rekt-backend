// Input validation middleware

const validateUsername = (username) => {
  if (!username || typeof username !== "string") {
    return { valid: false, message: "Username is required" };
  }

  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: "Username must be 3-20 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      message: "Username can only contain letters, numbers, and underscores",
    };
  }

  return { valid: true };
};

const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Invalid email format" };
  }

  return { valid: true };
};

const validateCreateAccount = (req, res, next) => {
  const { username, email } = req.body;

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({
      error: "Invalid username",
      message: usernameValidation.message,
    });
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return res.status(400).json({
      error: "Invalid email",
      message: emailValidation.message,
    });
  }

  next();
};

const validateSignIn = (req, res, next) => {
  const { email } = req.body;

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return res.status(400).json({
      error: "Invalid email",
      message: emailValidation.message,
    });
  }

  next();
};

module.exports = {
  validateUsername,
  validateEmail,
  validateCreateAccount,
  validateSignIn,
};
