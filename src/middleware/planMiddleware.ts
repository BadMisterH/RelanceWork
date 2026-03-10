import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptionService';

/**
 * Middleware : bloque les utilisateurs non-Pro sur les routes IA coûteuses.
 * À placer après authenticateToken (req.user doit déjà être défini).
 */
export const requireProPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = (req as any).user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }

  try {
    const { plan } = await subscriptionService.getUserPlan(userId);

    if (plan !== 'pro') {
      res.status(403).json({
        error: 'Cette fonctionnalité est réservée au plan Pro.',
        code: 'PRO_REQUIRED',
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Erreur de vérification du plan.' });
  }
};
