// controllers/volunteer.controller.js
import { VolunteerRegistration, HelpRequest } from "../models/volunteer.model.js";

// ── GET /volunteer ─────────────────────────────────────────────────────────────
// Public: returns approved volunteers, supports ?speciality=&search=
export const getVolunteers = async (req, res) => {
  try {
    const { speciality, search } = req.query;
    const filter = { isActive: true };

    if (speciality && speciality !== "all") {
      filter.speciality = speciality;
    }

    if (search) {
      filter.$or = [
        { name:         { $regex: search, $options: "i" } },
        { organisation: { $regex: search, $options: "i" } },
        { location:     { $regex: search, $options: "i" } },
      ];
    }

    const volunteers = await VolunteerRegistration.find(filter)
      .select("-idProof -__v")
      .sort({ rating: -1, helpedCount: -1 });

    res.json({ success: true, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /volunteer/register ───────────────────────────────────────────────────
// Public: submit volunteer application
export const registerVolunteer = async (req, res) => {
  try {
    const { name, organisation, phone, location, speciality, languages, bio, idProof } = req.body;

    if (!name || !phone || !speciality || !bio) {
      return res.status(400).json({ success: false, message: "Missing required fields: name, phone, speciality, bio" });
    }

    const existing = await VolunteerRegistration.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: "A registration with this phone number already exists" });
    }

    const registration = await VolunteerRegistration.create({
      name, organisation, phone, location, speciality, languages, bio, idProof,
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully. Our team will verify your details within 3–5 working days.",
      id: registration._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /volunteer/request ────────────────────────────────────────────────────
// Public (auth optional): submit a help request
export const submitHelpRequest = async (req, res) => {
  try {
    const { name, phone, location, helpType, urgency, description } = req.body;
    const userId = req.user?.uid || "";   // populated by verifyFirebaseToken if token present

    if (!name || !phone || !helpType || !description) {
      return res.status(400).json({ success: false, message: "Missing required fields: name, phone, helpType, description" });
    }

    const request = await HelpRequest.create({
      userId, name, phone, location, helpType, urgency, description,
    });

    res.status(201).json({
      success: true,
      message: "Help request submitted. A volunteer will contact you within 24–48 hours.",
      id: request._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /volunteer/admin/applications ─────────────────────────────────────────
// Protected: list pending volunteer applications
export const getPendingApplications = async (req, res) => {
  try {
    const applications = await VolunteerRegistration.find({ status: "pending" })
      .sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /volunteer/admin/applications/:id ────────────────────────────────────
// Protected: approve or reject a volunteer application
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }

    const update = { status };
    if (status === "approved") update.isActive = true;

    const application = await VolunteerRegistration.findByIdAndUpdate(id, update, { new: true });
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    res.json({ success: true, message: `Application ${status}`, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /volunteer/admin/requests ─────────────────────────────────────────────
// Protected: list all help requests
export const getHelpRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const requests = await HelpRequest.find(filter)
      .populate("assignedTo", "name phone organisation")
      .sort({ urgency: -1, createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};