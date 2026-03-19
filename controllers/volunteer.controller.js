// controllers/volunteer.controller.js
import { VolunteerRegistration, HelpRequest } from "../models/volunteer.model.js";

// ── GET /volunteer ─────────────────────────────────────────────────────────────
// Public — all active volunteers from DB only, no NGOs
export const getVolunteers = async (req, res) => {
  try {
    const { speciality, search } = req.query;
    const filter = { isActive: true };

    if (speciality && speciality !== "all") filter.speciality = speciality;
    if (search) {
      filter.$or = [
        { name:         { $regex: search, $options: "i" } },
        { organisation: { $regex: search, $options: "i" } },
        { location:     { $regex: search, $options: "i" } },
      ];
    }

    const volunteers = await VolunteerRegistration.find(filter)
      .select("-idProof -__v")
      .sort({ helpedCount: -1, createdAt: -1 });

    res.json({ success: true, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /volunteer/register ───────────────────────────────────────────────────
// Authenticated — instant registration, no verification, no Aadhaar/PAN
export const registerVolunteer = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, organisation, phone, location, speciality, languages, bio } = req.body;

    if (!name || !phone || !speciality || !bio) {
      return res.status(400).json({
        success: false,
        message: "name, phone, speciality and bio are required",
      });
    }

    const existing = await VolunteerRegistration.findOne({
      $or: [{ userId }, { phone }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Already registered as a volunteer.",
        registration: existing,
      });
    }

    const languageArray = Array.isArray(languages)
      ? languages
      : (languages || "").split(",").map((l) => l.trim()).filter(Boolean);

    const registration = await VolunteerRegistration.create({
      userId, name, organisation, phone, location,
      speciality, languages: languageArray, bio,
      status: "approved", isActive: true, available: true,
    });

    res.status(201).json({ success: true, registration });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /volunteer/:id ───────────────────────────────────────────────────────
// Authenticated — edit own volunteer registration
export const editVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const reg = await VolunteerRegistration.findById(id);
    if (!reg) return res.status(404).json({ success: false, message: "Not found" });
    if (reg.userId !== req.user.uid)
      return res.status(403).json({ success: false, message: "Not your registration" });

    const { name, organisation, phone, location, speciality, languages, bio, available } = req.body;
    const languageArray = languages
      ? Array.isArray(languages) ? languages : languages.split(",").map((l) => l.trim()).filter(Boolean)
      : reg.languages;

    const updated = await VolunteerRegistration.findByIdAndUpdate(
      id,
      { name, organisation, phone, location, speciality, languages: languageArray, bio, available },
      { new: true, runValidators: true }
    ).select("-idProof -__v");

    res.json({ success: true, registration: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /volunteer/:id ──────────────────────────────────────────────────────
// Authenticated — delete own volunteer registration
export const deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const reg = await VolunteerRegistration.findById(id);
    if (!reg) return res.status(404).json({ success: false, message: "Not found" });
    if (reg.userId !== req.user.uid)
      return res.status(403).json({ success: false, message: "Not your registration" });

    await VolunteerRegistration.findByIdAndDelete(id);
    res.json({ success: true, message: "Volunteer registration removed." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /volunteer/my-registration ────────────────────────────────────────────
export const getMyRegistration = async (req, res) => {
  try {
    const registration = await VolunteerRegistration.findOne({ userId: req.user.uid })
      .select("-idProof -__v");
    res.json({ success: true, registration: registration || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /volunteer/request ────────────────────────────────────────────────────
// Authenticated — submit help request, visible to volunteers only
export const submitHelpRequest = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, phone, location, helpType, urgency, description } = req.body;

    if (!name || !phone || !helpType || !description) {
      return res.status(400).json({
        success: false,
        message: "name, phone, helpType and description are required",
      });
    }

    const request = await HelpRequest.create({
      userId, name, phone, location, helpType, urgency, description,
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /volunteer/open-requests ──────────────────────────────────────────────
// Authenticated — visible to all logged-in users
// Phone is only included if the caller is a registered volunteer
export const getOpenRequests = async (req, res) => {
  try {
    const { helpType, urgency } = req.query;
    const filter = { status: "open" };
    if (helpType && helpType !== "all") filter.helpType = helpType;
    if (urgency  && urgency  !== "all") filter.urgency  = urgency;

    // Check if the caller is a registered volunteer
    const isVolunteer = !!(await VolunteerRegistration.exists({ userId: req.user.uid, isActive: true }));

    // Always strip userId. Strip phone too unless caller is a volunteer.
    const selectFields = isVolunteer
      ? "-userId -__v"
      : "-userId -phone -__v";

    const requests = await HelpRequest.find(filter)
      .select(selectFields)
      .sort({ urgency: -1, createdAt: -1 })
      .limit(50);

    res.json({ success: true, requests, isVolunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /volunteer/my-requests ─────────────────────────────────────────────────
// Authenticated — own requests (always includes phone since it's your own)
export const getMyRequests = async (req, res) => {
  try {
    const requests = await HelpRequest.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .select("-__v");
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /volunteer/request/:id ─────────────────────────────────────────────
// Authenticated — delete own help request
export const deleteHelpRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const req_ = await HelpRequest.findById(id);
    if (!req_) return res.status(404).json({ success: false, message: "Not found" });
    if (req_.userId !== req.user.uid)
      return res.status(403).json({ success: false, message: "Not your request" });

    await HelpRequest.findByIdAndDelete(id);
    res.json({ success: true, message: "Help request deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};