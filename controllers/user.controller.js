import User from "../models/user.model.js";
import cloudinary from "../configs/cloudinary.config.js";

export const getProfile = async (req, res) => {
  try {
    res.json({ success: true, user: req.dbUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { ...req.body },
      { new: true },
      { returnDocument: "after" }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const { language, notifications } = req.body;
    const updateData = {};
    if (language) updateData.language = language;
    if (notifications !== undefined) updateData.notifications = notifications;

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: updateData },
      { new: true },
      { returnDocument: "after" }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePersonalInfo = async (req, res) => {
  try {
    const { name, phone, personalInfo } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (personalInfo !== undefined) updateData.personalInfo = personalInfo;

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: updateData },
      { new: true },
      { returnDocument: "after" }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    // Delete old avatar from Cloudinary if exists
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (currentUser?.avatarPublicId) {
      await cloudinary.uploader.destroy(currentUser.avatarPublicId);
    }

    // Upload new image to Cloudinary from buffer
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "jansathi/avatars",
          transformation: [
            { width: 300, height: 300, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const { secure_url, public_id } = uploadResult;

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { avatar: secure_url, avatarPublicId: public_id } },
      { new: true },
      { returnDocument: "after" }
    );

    res.json({ success: true, user, avatarUrl: secure_url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const deleteAvatar = async (req, res) => {
  try {
    const currentUser = await User.findOne({ uid: req.user.uid });
    
    // Delete from Cloudinary
    if (currentUser?.avatarPublicId) {
      await cloudinary.uploader.destroy(currentUser.avatarPublicId);
    }

    // Clear from DB
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { avatar: "", avatarPublicId: "" } },
      { new: true },
      { returnDocument: "after" }
    );

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};