import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { subscriptionService } from "../services/subscriptionService";

const router = Router();

/**
 * POST /api/search/check
 * Vérifie si l'utilisateur peut encore effectuer des recherches ce mois
 */
router.post("/check", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = await subscriptionService.checkLimit(userId, "searches");

    res.json(limit);
  } catch (error: any) {
    console.error("Error checking search limit:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/track
 * Incrémente le compteur de recherches et retourne le nouveau total
 */
router.post("/track", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Vérifier la limite avant d'incrémenter
    const limit = await subscriptionService.checkLimit(userId, "searches");
    if (!limit.allowed) {
      res.status(403).json({
        message: `Limite atteinte: ${limit.current}/${limit.max} recherches ce mois (plan gratuit)`,
        upgrade_required: true,
        current: limit.current,
        max: limit.max,
      });
      return;
    }

    const result = await subscriptionService.incrementSearchCount(userId);

    res.json({
      success: true,
      current: result.current,
      max: result.max,
    });
  } catch (error: any) {
    console.error("Error tracking search:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
