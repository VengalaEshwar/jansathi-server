import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      sparse: true, // allows null for non-Firebase users
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
      default: null, // optional now since Firebase handles auth
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatar: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    language: { type: String, default: "en" },
    location: { type: String, default: "" },
    age: { type: Number, default: null },
    notifications: {
      enabled: { type: Boolean, default: true },
      medicationReminders: { type: Boolean, default: true },
      appointmentAlerts: { type: Boolean, default: true },
      governmentUpdates: { type: Boolean, default: true },
    },
    accessibility: {
      textSize: { type: String, default: "medium" },
      highContrast: { type: Boolean, default: false },
      screenReader: { type: Boolean, default: false },
      voiceNavigation: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;