import { Request, Response, NextFunction } from 'express';
import { isProUser, isAdmin } from '../config/admin';

/**
 * Middleware pour vérifier l'accès Pro
 * Bloque les utilisateurs Free
 */
export const requireProAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      res.status(401).json({
        message: "Authentification requise",
        plan: 'free'
      });
      return;
    }

    // Vérifier si l'utilisateur a accès Pro
    if (!isProUser(user.id)) {
      res.status(403).json({
        message: "Cette fonctionnalité est réservée aux utilisateurs Pro. Passez à la version Pro pour débloquer toutes les fonctionnalités.",
        plan: 'free',
        requiredPlan: 'pro'
      });
      return;
    }

    // Utilisateur a accès Pro, continuer
    next();
  } catch (error) {
    console.error('Erreur middleware Pro:', error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Middleware pour vérifier l'accès Admin
 */
export const requireAdminAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      res.status(401).json({
        message: "Authentification requise"
      });
      return;
    }

    // Vérifier si l'utilisateur est admin
    if (!isAdmin(user.id)) {
      res.status(403).json({
        message: "Accès réservé aux administrateurs",
        plan: 'free'
      });
      return;
    }

    // Utilisateur est admin, continuer
    next();
  } catch (error) {
    console.error('Erreur middleware Admin:', error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
