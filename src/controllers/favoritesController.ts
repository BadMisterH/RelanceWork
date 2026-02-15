import { Request, Response } from "express";
import db from "../config/database";

// GET /api/favorites - Récupérer tous les favoris de l'utilisateur connecté
export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  try {
    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Récupérer les favoris de l'utilisateur depuis SQLite
    const stmt = db.prepare(`
      SELECT id, place_id, business_data, created_at
      FROM favorites
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    const favorites = stmt.all(userId);

    // Parser le JSON stocké dans business_data
    const parsedFavorites = favorites.map((fav: any) => ({
      id: fav.id,
      placeId: fav.place_id,
      businessData: JSON.parse(fav.business_data),
      createdAt: fav.created_at,
    }));

    res.json(parsedFavorites);
  } catch (error) {
    console.error("❌ Erreur récupération favoris:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// POST /api/favorites - Ajouter un favori
export const addFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { placeId, businessData } = req.body;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Vérifier que les champs obligatoires sont présents
    if (!placeId || !businessData) {
      res.status(400).json({
        message: "Champs obligatoires manquants: placeId, businessData"
      });
      return;
    }

    // Vérifier si le favori existe déjà
    const checkStmt = db.prepare(`
      SELECT id FROM favorites
      WHERE user_id = ? AND place_id = ?
    `);

    const existing = checkStmt.get(userId, placeId);

    if (existing) {
      res.status(409).json({ message: "Ce favori existe déjà" });
      return;
    }

    // Insérer le favori
    const insertStmt = db.prepare(`
      INSERT INTO favorites (user_id, place_id, business_data)
      VALUES (?, ?, ?)
    `);

    const result = insertStmt.run(userId, placeId, JSON.stringify(businessData));

    // Récupérer le favori créé
    const getStmt = db.prepare(`
      SELECT id, place_id, business_data, created_at
      FROM favorites
      WHERE id = ?
    `);

    const newFavorite = getStmt.get(result.lastInsertRowid) as any;

    console.log(`✅ Favori ajouté: ${placeId}`);

    res.status(201).json({
      message: "Favori ajouté avec succès",
      data: {
        id: newFavorite.id,
        placeId: newFavorite.place_id,
        businessData: JSON.parse(newFavorite.business_data),
        createdAt: newFavorite.created_at,
      }
    });
  } catch (error) {
    console.error("❌ Erreur ajout favori:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// DELETE /api/favorites/:placeId - Supprimer un favori
export const deleteFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Vérifier que le favori existe et appartient à l'utilisateur
    const checkStmt = db.prepare(`
      SELECT id FROM favorites
      WHERE user_id = ? AND place_id = ?
    `);

    const existing = checkStmt.get(userId, placeId);

    if (!existing) {
      res.status(404).json({ message: "Favori non trouvé" });
      return;
    }

    // Supprimer le favori
    const deleteStmt = db.prepare(`
      DELETE FROM favorites
      WHERE user_id = ? AND place_id = ?
    `);

    deleteStmt.run(userId, placeId);

    console.log(`✅ Favori supprimé: ${placeId}`);

    res.json({ message: "Favori supprimé avec succès" });
  } catch (error) {
    console.error("❌ Erreur suppression favori:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
