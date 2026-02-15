import { Router } from "express";
import {
  getFavorites,
  addFavorite,
  deleteFavorite,
} from "../controllers/favoritesController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// GET /favorites - Récupérer tous les favoris de l'utilisateur
router.get("/favorites", authenticateToken, getFavorites);

// POST /favorites - Ajouter un favori
router.post("/favorites", authenticateToken, addFavorite);

// DELETE /favorites/:placeId - Supprimer un favori
router.delete("/favorites/:placeId", authenticateToken, deleteFavorite);

export default router;
