const express = require("express");
const multer = require("multer");
const { processAvatar, uploadAvatar } = require("../utils/storage");

const router = express.Router();

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    // Check allowed image types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }

    cb(null, true);
  },
});

// POST /api/upload/avatar - Upload avatar image
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        message: "Please select an image file",
      });
    }

    // Process the image (resize, optimize)
    const processed = await processAvatar(
      req.file.buffer,
      req.file.originalname
    );

    // Upload to Supabase Storage
    const uploadResult = await uploadAvatar(
      req.supabase,
      processed.buffer,
      processed.filename
    );

    res.json({
      success: true,
      avatar_url: uploadResult.publicUrl,
      filename: processed.filename,
      message: "Avatar uploaded successfully",
    });
  } catch (error) {
    console.error("❌ Avatar upload error:", error);

    // Handle specific errors
    if (error.message.includes("Image processing failed")) {
      return res.status(400).json({
        success: false,
        error: "Invalid image",
        message: "Unable to process image. Please try a different file.",
      });
    }

    if (error.message.includes("Avatar upload failed")) {
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        message: "Unable to upload avatar. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Upload error",
      message: "Avatar upload failed",
    });
  }
});

module.exports = router;
