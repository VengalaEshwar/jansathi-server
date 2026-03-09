import User from "../models/user.model.js";

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
      { new: true }
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
      { new: true }
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
      { new: true }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};