// routes/volunteer.routes.js
import express from "express";
import {
  getVolunteers,
  registerVolunteer,
  submitHelpRequest,
  getPendingApplications,
  updateApplicationStatus,
  getHelpRequests,
} from "../controllers/volunteer.controller.js";
import verifyFirebaseToken from "../utils/firebaseAuth.js";

const router = express.Router();

// ── Public routes (no auth needed) ───────────────────────────────────────────
// GET  /volunteer               — approved volunteer directory (?speciality=&search=)
router.get("/", getVolunteers);

// POST /volunteer/register      — submit volunteer registration application
router.post("/register", registerVolunteer);

// POST /volunteer/request       — submit help request (auth optional)
router.post("/request", submitHelpRequest);

// ── Protected routes (require Firebase token) ─────────────────────────────────
// GET  /volunteer/admin/applications       — list pending applications
router.get("/admin/applications", verifyFirebaseToken, getPendingApplications);

// PATCH /volunteer/admin/applications/:id  — approve or reject
router.patch("/admin/applications/:id", verifyFirebaseToken, updateApplicationStatus);

// GET  /volunteer/admin/requests           — list all help requests
router.get("/admin/requests", verifyFirebaseToken, getHelpRequests);

export default router;