/**
 * Configuration des administrateurs et utilisateurs Pro
 */

// Liste des IDs utilisateurs qui ont accès à la version Pro
export const PRO_USER_IDS = [
  '0329a234-663a-47a3-90d4-12d376e35991', // Admin principal
];

// Liste des IDs administrateurs (accès complet)
export const ADMIN_USER_IDS = [
  '0329a234-663a-47a3-90d4-12d376e35991', // Admin principal
];

/**
 * Vérifie si un utilisateur a accès Pro
 */
export function isProUser(userId: string): boolean {
  return PRO_USER_IDS.includes(userId) || ADMIN_USER_IDS.includes(userId);
}

/**
 * Vérifie si un utilisateur est administrateur
 */
export function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

/**
 * Obtient le plan d'un utilisateur
 */
export function getUserPlan(userId: string): 'free' | 'pro' | 'admin' {
  if (ADMIN_USER_IDS.includes(userId)) {
    return 'admin';
  }
  if (PRO_USER_IDS.includes(userId)) {
    return 'pro';
  }
  return 'free';
}
