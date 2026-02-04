import { Router } from "express";
import {
  signup,
  login,
  logout,
  getCurrentUser,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);

// Protected routes
router.post("/logout", authenticateToken, logout);
router.get("/me", authenticateToken, getCurrentUser);

export default router;
