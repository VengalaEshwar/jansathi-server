import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    password: { type: String, minlength: 6, select: false, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    avatar: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    avatarPublicId: { type: String, default: "" },
    // ── Preferences ──────────────────────────────────────────────
    language: { type: String, enum: ["en", "hi", "te"], default: "en" },
    notifications: {
      enabled: { type: Boolean, default: true },
      medicationReminders: { type: Boolean, default: true },
      appointmentAlerts: { type: Boolean, default: true },
      governmentUpdates: { type: Boolean, default: true },
    },

    // ── Personal Info ─────────────────────────────────────────────
    personalInfo: {
      dob: { type: String, default: "" },
      gender: { type: String, default: "" },
      address: { type: String, default: "" },
      location: { type: String, default: "" },
      age: { type: Number, default: null },
      extra: [
        {
          label: { type: String },
          value: { type: String },
        }
      ],
    },
    prescriptionHistory: [
      {
        imageUrl: { type: String },
        imagePublicId: { type: String },
        result: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    medicineHistory: [
      {
        imageUrl: { type: String },
        imagePublicId: { type: String },
        result: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;