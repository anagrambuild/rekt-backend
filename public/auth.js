// Configuration
const CONFIG = {
  USER_API:
    window.location.hostname === "localhost"
      ? "http://localhost:3005"
      : "https://rekt-user-management.onrender.com",
};

// Global state
let currentUser = null;
let usernameTimeout = null;
let emailTimeout = null;

// DOM Elements
const authOptions = document.getElementById("auth-options");
const signinForm = document.getElementById("signin-form");
const createAccountForm = document.getElementById("create-account-form");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkExistingSession();
});

// Check if user is already signed in
function checkExistingSession() {
  const userData = localStorage.getItem("rekt_user");
  if (userData) {
    try {
      const sessionData = JSON.parse(userData);
      if (sessionData.isAuthenticated) {
        currentUser = sessionData;
        redirectToDashboard();
      } else {
        // Invalid session, clear it
        localStorage.removeItem("rekt_user");
      }
    } catch (error) {
      console.error("Invalid session data:", error);
      localStorage.removeItem("rekt_user");
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // Auth option buttons
  document.getElementById("signin-btn").addEventListener("click", showSignIn);
  document
    .getElementById("create-account-btn")
    .addEventListener("click", showCreateAccount);

  // Form submissions
  document
    .getElementById("signin-form-element")
    .addEventListener("submit", handleSignIn);
  document
    .getElementById("create-account-form-element")
    .addEventListener("submit", handleCreateAccount);

  // Real-time validation
  document
    .getElementById("username")
    .addEventListener("input", handleUsernameInput);
  document.getElementById("email").addEventListener("input", handleEmailInput);
  document
    .getElementById("signin-email")
    .addEventListener("input", handleSignInEmailInput);

  // Avatar upload
  document
    .getElementById("avatar")
    .addEventListener("change", handleAvatarUpload);
}

// Show/hide forms
function showOptions() {
  authOptions.style.display = "flex";
  signinForm.classList.remove("active");
  createAccountForm.classList.remove("active");
}

function showSignIn() {
  authOptions.style.display = "none";
  signinForm.classList.add("active");
  document.getElementById("signin-email").focus();
}

function showCreateAccount() {
  authOptions.style.display = "none";
  createAccountForm.classList.add("active");
  document.getElementById("username").focus();
}

// Real-time username validation
function handleUsernameInput(e) {
  const username = e.target.value.trim();
  const feedback = document.getElementById("username-feedback");

  // Clear previous timeout
  clearTimeout(usernameTimeout);

  if (username.length < 3) {
    feedback.textContent =
      username.length > 0 ? "Username must be at least 3 characters" : "";
    feedback.className = "validation-feedback error";
    return;
  }

  if (username.length > 20) {
    feedback.textContent = "Username must be 20 characters or less";
    feedback.className = "validation-feedback error";
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    feedback.textContent =
      "Username can only contain letters, numbers, and underscores";
    feedback.className = "validation-feedback error";
    return;
  }

  // Show checking state
  feedback.textContent = "Checking availability...";
  feedback.className = "validation-feedback checking";

  // Debounced API call
  usernameTimeout = setTimeout(() => checkUsernameAvailability(username), 500);
}

// Check username availability
async function checkUsernameAvailability(username) {
  try {
    const response = await fetch(`${CONFIG.USER_API}/api/auth/check-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const result = await response.json();
    const feedback = document.getElementById("username-feedback");

    if (result.available) {
      feedback.textContent = "✓ Username available";
      feedback.className = "validation-feedback success";
    } else {
      feedback.textContent = `Username taken. Try: ${
        result.suggestions?.join(", ") || "something else"
      }`;
      feedback.className = "validation-feedback error";
    }
  } catch (error) {
    console.error("Username check failed:", error);
    const feedback = document.getElementById("username-feedback");
    feedback.textContent = "Unable to check username";
    feedback.className = "validation-feedback error";
  }
}

// Real-time email validation
function handleEmailInput(e) {
  const email = e.target.value.trim();
  const feedback = document.getElementById("email-feedback");

  clearTimeout(emailTimeout);

  if (!email) {
    feedback.textContent = "";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    feedback.textContent = "Please enter a valid email address";
    feedback.className = "validation-feedback error";
    return;
  }

  feedback.textContent = "Checking email...";
  feedback.className = "validation-feedback checking";

  emailTimeout = setTimeout(() => checkEmailUniqueness(email), 500);
}

// Check email uniqueness
async function checkEmailUniqueness(email) {
  try {
    const response = await fetch(`${CONFIG.USER_API}/api/auth/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    const feedback = document.getElementById("email-feedback");

    if (result.exists) {
      feedback.textContent = "Email already exists. Sign in instead?";
      feedback.className = "validation-feedback error";
    } else {
      feedback.textContent = "✓ Email available";
      feedback.className = "validation-feedback success";
    }
  } catch (error) {
    console.error("Email check failed:", error);
    const feedback = document.getElementById("email-feedback");
    feedback.textContent = "Unable to check email";
    feedback.className = "validation-feedback error";
  }
}

// Sign in email validation
function handleSignInEmailInput(e) {
  const email = e.target.value.trim();
  const feedback = document.getElementById("signin-email-feedback");

  if (!email) {
    feedback.textContent = "";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    feedback.textContent = "Please enter a valid email address";
    feedback.className = "validation-feedback error";
  } else {
    feedback.textContent = "";
  }
}

// Handle avatar upload
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  const preview = document.getElementById("avatar-preview");

  if (!file) {
    preview.innerHTML = "";
    return;
  }

  // Validate file size
  if (file.size > 5 * 1024 * 1024) {
    alert("Avatar must be less than 5MB");
    e.target.value = "";
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.innerHTML = `<img src="${e.target.result}" alt="Avatar preview">`;
  };
  reader.readAsDataURL(file);
}

// Handle sign in
async function handleSignIn(e) {
  e.preventDefault();

  const email = document.getElementById("signin-email").value.trim();
  const submitBtn = document.getElementById("signin-btn-text");
  const loading = document.getElementById("signin-loading");
  const feedback = document.getElementById("signin-email-feedback");

  // Show loading state
  submitBtn.style.display = "none";
  loading.style.display = "inline-block";

  try {
    const response = await fetch(`${CONFIG.USER_API}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (result.success) {
      // Store user data with session info
      currentUser = result.user;
      const sessionData = {
        ...result.user,
        loginTime: Date.now(),
        isAuthenticated: true,
      };
      localStorage.setItem("rekt_user", JSON.stringify(sessionData));

      // Redirect to dashboard
      redirectToDashboard();
    } else {
      feedback.textContent = result.message || "Sign in failed";
      feedback.className = "validation-feedback error";
    }
  } catch (error) {
    console.error("Sign in error:", error);
    feedback.textContent = "Sign in failed. Please try again.";
    feedback.className = "validation-feedback error";
  } finally {
    // Hide loading state
    submitBtn.style.display = "inline";
    loading.style.display = "none";
  }
}

// Handle create account
async function handleCreateAccount(e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const avatarFile = document.getElementById("avatar").files[0];

  const submitBtn = document.getElementById("create-account-btn-text");
  const loading = document.getElementById("create-account-loading");

  // Show loading state
  submitBtn.style.display = "none";
  loading.style.display = "inline-block";

  try {
    let avatarUrl = null;

    // Upload avatar if provided
    if (avatarFile) {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const uploadResponse = await fetch(
        `${CONFIG.USER_API}/api/upload/avatar`,
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadResult = await uploadResponse.json();
      if (uploadResult.success) {
        avatarUrl = uploadResult.avatar_url;
      } else {
        throw new Error("Avatar upload failed");
      }
    }

    // Create account
    const response = await fetch(`${CONFIG.USER_API}/api/auth/create-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, avatar_url: avatarUrl }),
    });

    const result = await response.json();

    if (result.success) {
      // Store user data with session info
      currentUser = result.user;
      const sessionData = {
        ...result.user,
        loginTime: Date.now(),
        isAuthenticated: true,
      };
      localStorage.setItem("rekt_user", JSON.stringify(sessionData));

      // Redirect to dashboard
      redirectToDashboard();
    } else {
      // Show error in appropriate field
      if (result.error === "Username taken") {
        const feedback = document.getElementById("username-feedback");
        feedback.textContent =
          result.message +
          (result.suggestions ? ` Try: ${result.suggestions.join(", ")}` : "");
        feedback.className = "validation-feedback error";
      } else if (result.error === "Email exists") {
        const feedback = document.getElementById("email-feedback");
        feedback.textContent = result.message;
        feedback.className = "validation-feedback error";
      } else {
        alert(result.message || "Account creation failed");
      }
    }
  } catch (error) {
    console.error("Account creation error:", error);
    alert("Account creation failed. Please try again.");
  } finally {
    // Hide loading state
    submitBtn.style.display = "inline";
    loading.style.display = "none";
  }
}

// Redirect to dashboard
function redirectToDashboard() {
  window.location.href = "/dashboard.html";
}

// Utility function to get current user
function getCurrentUser() {
  return currentUser;
}
