import express from "express"
import  verifyFirebaseToken  from "../utils/firebaseAuth.js"
import { getSchemes, getEligibleSchemes } from "../controllers/scheme.controller.js"

const router = express.Router()

router.get("/", verifyFirebaseToken, getSchemes)
router.post("/eligible", verifyFirebaseToken, getEligibleSchemes)

export default router