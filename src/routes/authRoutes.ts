import { Router } from "express";
import {
  signup,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resendVerification,
  notifyPasswordChanged,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/resend-verification", resendVerification);

// Protected routes
router.post("/logout", authenticateToken, logout);
router.post("/password-changed", authenticateToken, notifyPasswordChanged);
router.get("/me", authenticateToken, getCurrentUser);

export default router;
