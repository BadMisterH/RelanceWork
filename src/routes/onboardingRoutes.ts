import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  saveOnboardingProfile,
  getOnboardingStatus,
  triggerOnboardingEmails,
} from "../controllers/onboardingController";

const router = Router();

// GET /api/onboarding/status — Check onboarding completion (authenticated)
router.get("/status", authenticateToken, getOnboardingStatus);

// POST /api/onboarding/profile — Save wizard answers (authenticated)
router.post("/profile", authenticateToken, saveOnboardingProfile);

// POST /api/onboarding/emails/trigger — Cron-triggered email dispatch (protected by CRON_SECRET)
router.post("/emails/trigger", triggerOnboardingEmails);

export default router;
