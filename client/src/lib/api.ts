import axios from 'axios';
import { supabase } from './supabase';

// Créer une instance axios avec la base URL de l'API
// En production, utilise la même origine que le site. En dev, pointe vers localhost:3000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Intercepteur pour attacher automatiquement le token Supabase à chaque requête
api.interceptors.request.use(async (config) => {
  try {
    // Récupérer la session actuelle de Supabase
    const { data: { session } } = await supabase.auth.getSession();

    // Si une session existe, attacher le token à l'en-tête Authorization
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du token:', error);
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si le token est invalide ou expiré (401/403), rediriger vers la page de connexion
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('Token invalide ou expiré - redirection vers login');
      // Déconnecter l'utilisateur de Supabase
      await supabase.auth.signOut();
      // Rediriger vers la page d'authentification
      window.location.href = '/auth.html';
    }
    return Promise.reject(error);
  }
);

export default api;
