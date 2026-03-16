import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, sparse: true },
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    password: { type: String, minlength: 6, select: false, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    avatar: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    avatarPublicId: { type: String, default: "" },

    // ── Preferences ────────────────────────────────────────────────────────
    language: { type: String, enum: ["en", "hi", "te"], default: "en" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    soundEnabled: { type: Boolean, default: true },
    preferences: {
      theme:        { type: String, enum: ["dark", "light"], default: "dark" },
      language:     { type: String, default: "en" },
      soundEnabled: { type: Boolean, default: true },
    },
    notifications: {
      enabled:             { type: Boolean, default: true },
      medicationReminders: { type: Boolean, default: true },
      appointmentAlerts:   { type: Boolean, default: true },
      governmentUpdates:   { type: Boolean, default: true },
    },

    // ── Personal Info ───────────────────────────────────────────────────────
    personalInfo: {
      dob:      { type: String, default: "" },
      gender:   { type: String, default: "" },
      address:  { type: String, default: "" },
      location: { type: String, default: "" },
      age:      { type: Number, default: null },
      extra: [{ label: { type: String }, value: { type: String } }],
    },

    // ── Prescription History ────────────────────────────────────────────────
    prescriptionHistory: [
      {
        imageUrl:      { type: String },
        imagePublicId: { type: String },
        result:        { type: String },
        // ✅ Extracted medicine names stored by Groq — used for danger alert matching
        medicines:     { type: [String], default: [] },
        createdAt:     { type: Date, default: Date.now },
      },
    ],

    // ── Medicine Scanner History ────────────────────────────────────────────
    medicineHistory: [
      {
        imageUrl:      { type: String },
        imagePublicId: { type: String },
        result:        { type: String },
        // ✅ Extracted medicine names stored by Groq — used for danger alert matching
        medicines:     { type: [String], default: [] },
        createdAt:     { type: Date, default: Date.now },
      },
    ],

    formHistory: [
      {
        pdfUrl:       { type: String },
        pdfPublicId:  { type: String },
        formFields:   [{ label: { type: String }, value: { type: String } }],
        createdAt:    { type: Date, default: Date.now },
        pdfBase64:    { type: String, default: "" },
      },
    ],

    phoneVerified:  { type: Boolean, default: false },
    emailVerified:  { type: Boolean, default: false },
    phoneOtp:       { type: String, default: null },
    phoneOtpExpiry: { type: Date,   default: null },
    emailOtp:       { type: String, default: null },
    emailOtpExpiry: { type: Date,   default: null },
    fcmToken:       { type: String, default: "" },

    medicationReminders: [
      {
        medicineName: String,
        dosage:       String,
        times:        [String],
        startDate:    Date,
        endDate:      Date,
        isEveryday:   Boolean,
        notifySms:    Boolean,
        notifyEmail:  Boolean,
        isActive:     Boolean,
        createdAt:    Date,
        notifyApp:    { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;