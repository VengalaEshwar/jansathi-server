// routes/volunteer.routes.js
import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import {
  getVolunteers,
  registerVolunteer,
  editVolunteer,
  deleteVolunteer,
  getMyRegistration,
  submitHelpRequest,
  getOpenRequests,
  getMyRequests,
  deleteHelpRequest,
} from "../controllers/volunteer.controller.js";

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get("/", getVolunteers);                          // GET  /volunteer

// ── Authenticated ──────────────────────────────────────────────────────────────
router.post  ("/register",        verifyFirebaseToken, registerVolunteer);   // POST /volunteer/register
router.get   ("/my-registration", verifyFirebaseToken, getMyRegistration);   // GET  /volunteer/my-registration
router.post  ("/request",         verifyFirebaseToken, submitHelpRequest);   // POST /volunteer/request
router.get   ("/open-requests",   verifyFirebaseToken, getOpenRequests);     // GET  /volunteer/open-requests
router.get   ("/my-requests",     verifyFirebaseToken, getMyRequests);       // GET  /volunteer/my-requests
router.delete("/request/:id",     verifyFirebaseToken, deleteHelpRequest);   // DELETE /volunteer/request/:id

// ── Must be LAST — param routes catch-all ─────────────────────────────────────
router.patch ("/edit/:id",   verifyFirebaseToken, editVolunteer);    // PATCH  /volunteer/edit/:id
router.delete("/delete/:id", verifyFirebaseToken, deleteVolunteer);  // DELETE /volunteer/delete/:id

export default router;