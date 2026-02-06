import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: "Token d'authentification manquant" });
    return;
  }

  try {
    // Valider le token avec Supabase Auth
    // @ts-ignore - Supabase types may not be fully recognized
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(403).json({ message: "Token invalide ou expiré" });
      return;
    }

    // Attacher l'utilisateur Supabase à la requête
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(403).json({ message: "Token invalide ou expiré" });
  }
};
