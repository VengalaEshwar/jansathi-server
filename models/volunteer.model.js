// models/volunteer.model.js
import mongoose from "mongoose";

// ── Volunteer Registration ─────────────────────────────────────────────────────
const volunteerRegistrationSchema = new mongoose.Schema(
  {
    // ✅ Linked to Firebase user — set when a logged-in user registers
    userId:       { type: String, default: "", index: true },

    name:         { type: String, required: true, trim: true },
    organisation: { type: String, default: "", trim: true },
    phone:        { type: String, required: true, trim: true },
    location:     { type: String, default: "", trim: true },

    // ✅ Coordinates for "nearby" queries
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    speciality: {
      type: String,
      enum: ["legal", "health", "education", "government", "general"],
      required: true,
    },

    // ✅ Array instead of comma-separated string
    languages:   { type: [String], default: [] },
    bio:         { type: String, required: true },
    idProof:     { type: String, default: "" },

    status:      { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isActive:    { type: Boolean, default: false },
    rating:      { type: Number, default: 0 },
    helpedCount: { type: Number, default: 0 },
    available:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Help Request ───────────────────────────────────────────────────────────────
const helpRequestSchema = new mongoose.Schema(
  {
    userId:      { type: String, default: "", index: true },
    name:        { type: String, required: true, trim: true },
    phone:       { type: String, required: true, trim: true },
    location:    { type: String, default: "", trim: true },
    helpType: {
      type: String,
      enum: ["legal", "health", "education", "government", "general"],
      required: true,
    },
    urgency:     { type: String, enum: ["normal", "urgent"], default: "normal" },
    description: { type: String, required: true },
    status:      { type: String, enum: ["open", "assigned", "resolved"], default: "open" },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: "VolunteerRegistration", default: null },
  },
  { timestamps: true }
);

export const VolunteerRegistration = mongoose.model("VolunteerRegistration", volunteerRegistrationSchema);
export const HelpRequest           = mongoose.model("HelpRequest",           helpRequestSchema);