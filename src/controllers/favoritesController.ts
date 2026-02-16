import { Request, Response } from "express";
import { supabase } from "../config/supabase";

// GET /api/favorites - Récupérer tous les favoris de l'utilisateur connecté
export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    const { data: favorites, error } = await supabase
      .from('favorites')
      .select('id, place_id, business_data, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("❌ Erreur récupération favoris:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des favoris" });
      return;
    }

    const parsedFavorites = (favorites || []).map((fav: any) => ({
      id: fav.id,
      placeId: fav.place_id,
      businessData: typeof fav.business_data === 'string' ? JSON.parse(fav.business_data) : fav.business_data,
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

    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    if (!placeId || !businessData) {
      res.status(400).json({
        message: "Champs obligatoires manquants: placeId, businessData"
      });
      return;
    }

    // Vérifier si le favori existe déjà
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ message: "Ce favori existe déjà" });
      return;
    }

    // Insérer le favori
    const { data: newFavorite, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        place_id: placeId,
        business_data: typeof businessData === 'string' ? businessData : JSON.stringify(businessData),
      })
      .select('id, place_id, business_data, created_at')
      .single();

    if (error) {
      console.error('❌ Erreur insertion favori:', error);
      res.status(500).json({ message: "Erreur lors de l'ajout du favori" });
      return;
    }

    console.log(`✅ Favori ajouté: ${placeId}`);

    res.status(201).json({
      message: "Favori ajouté avec succès",
      data: {
        id: newFavorite.id,
        placeId: newFavorite.place_id,
        businessData: typeof newFavorite.business_data === 'string' ? JSON.parse(newFavorite.business_data) : newFavorite.business_data,
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

    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Vérifier que le favori existe
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ message: "Favori non trouvé" });
      return;
    }

    // Supprimer le favori
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    if (error) {
      console.error('❌ Erreur suppression favori:', error);
      res.status(500).json({ message: "Erreur lors de la suppression" });
      return;
    }

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
