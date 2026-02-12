import { Request, Response, NextFunction } from "express";
import { subscriptionService, Plan } from "../services/subscriptionService";

/**
 * Middleware qui vérifie que l'utilisateur a le plan requis
 * Usage: router.get('/route', authenticateToken, checkPlan('pro'), handler)
 */
export const checkPlan = (requiredPlan: Plan) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ message: "Non authentifié" });
        return;
      }

      const { plan } = await subscriptionService.getUserPlan(userId);

      if (requiredPlan === "pro" && plan !== "pro") {
        res.status(403).json({
          message: "Cette fonctionnalité nécessite le plan Pro",
          required_plan: "pro",
          current_plan: plan,
          upgrade_required: true,
        });
        return;
      }

      next();
    } catch (error) {
      console.error("checkPlan middleware error:", error);
      res.status(500).json({ message: "Erreur lors de la vérification du plan" });
    }
  };
};

/**
 * Middleware qui vérifie la limite de recherches (plan free = 15/mois)
 */
export const checkSearchLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Non authentifié" });
      return;
    }

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

    next();
  } catch (error) {
    console.error("checkSearchLimit error:", error);
    res.status(500).json({ message: "Erreur lors de la vérification des limites" });
  }
};

/**
 * Middleware qui vérifie la limite de candidatures (plan free = 10 max)
 */
export const checkApplicationLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Non authentifié" });
      return;
    }

    const limit = await subscriptionService.checkLimit(userId, "applications");

    if (!limit.allowed) {
      res.status(403).json({
        message: `Limite atteinte: ${limit.current}/${limit.max} candidatures (plan gratuit)`,
        upgrade_required: true,
        current: limit.current,
        max: limit.max,
      });
      return;
    }

    next();
  } catch (error) {
    console.error("checkApplicationLimit error:", error);
    res.status(500).json({ message: "Erreur lors de la vérification des limites" });
  }
};
