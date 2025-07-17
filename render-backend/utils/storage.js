const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

// Avatar processing and upload utility
const processAvatar = async (buffer, filename) => {
  try {
    // Process image: resize to 200x200, convert to WebP for efficiency
    const processedBuffer = await sharp(buffer)
      .resize(200, 200, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}.webp`;

    return {
      buffer: processedBuffer,
      filename: uniqueFilename,
      contentType: "image/webp",
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

// Upload avatar to Supabase Storage
const uploadAvatar = async (supabase, buffer, filename) => {
  try {
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(filename, buffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filename);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  } catch (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }
};

// Delete avatar from storage
const deleteAvatar = async (supabase, filename) => {
  try {
    const { error } = await supabase.storage.from("avatars").remove([filename]);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Avatar deletion failed:", error);
    return false;
  }
};

module.exports = {
  processAvatar,
  uploadAvatar,
  deleteAvatar,
};
