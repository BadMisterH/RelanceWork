/**
 * Validation et vérification des emails
 */

// Liste des domaines d'emails temporaires/jetables les plus courants
const DISPOSABLE_EMAIL_DOMAINS = [
  // Services d'emails temporaires populaires
  'temp-mail.org',
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'throwaway.email',
  'getnada.com',
  'trashmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'mailnesia.com',
  'mytemp.email',
  'temp-mail.io',
  'mohmal.com',
  'throwawaymail.com',
  'yopmail.com',
  '10minutemail.com',
  'emailondeck.com',
  'mintemail.com',
  'dispostable.com',
  'emailfake.com',
  'inboxkitten.com',
  'anonymousemail.me',
  'crazymailing.com',
  'mailcatch.com',
  'mailtothis.com',
  'tempinbox.com',
  'incognitomail.com',
  'fakemail.net',
  'tmails.net',
  'tempmail.net',
  'getairmail.com',
  'mailsac.com',
  'burnermail.io',
  'emailtemporanea.net',
  'emailtemporanea.com',
  'correotemporal.org',
  // Ajoutez d'autres domaines suspects au besoin
];

/**
 * Valide le format d'un email
 */
export function isValidEmailFormat(email: string): boolean {
  // Regex stricte pour validation d'email
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Vérifier que l'email contient bien un @ et un domaine
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;

  // Vérifier la partie locale
  if (!localPart || localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Vérifier le domaine
  if (!domain || domain.length === 0 || domain.length > 255) {
    return false;
  }

  // Le domaine doit contenir au moins un point
  if (!domain.includes('.')) {
    return false;
  }

  return true;
}

/**
 * Vérifie si l'email utilise un domaine jetable/temporaire
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];

  if (!domain) {
    return true; // Email invalide = considéré comme jetable
  }

  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Valide un email de manière complète
 * Retourne null si valide, sinon un message d'erreur
 */
export function validateEmail(email: string): string | null {
  // Vérifier que l'email n'est pas vide
  if (!email || email.trim() === '') {
    return "L'email est requis";
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Vérifier le format
  if (!isValidEmailFormat(trimmedEmail)) {
    return "Format d'email invalide";
  }

  // Vérifier que ce n'est pas un email jetable
  if (isDisposableEmail(trimmedEmail)) {
    return "Les emails temporaires ou jetables ne sont pas autorisés. Veuillez utiliser un email permanent.";
  }

  return null; // Email valide
}

/**
 * Ajoute des domaines à la liste noire
 */
export function addDisposableDomain(domain: string): void {
  const normalizedDomain = domain.toLowerCase().trim();
  if (!DISPOSABLE_EMAIL_DOMAINS.includes(normalizedDomain)) {
    DISPOSABLE_EMAIL_DOMAINS.push(normalizedDomain);
  }
}

/**
 * Obtient la liste des domaines jetables
 */
export function getDisposableDomains(): string[] {
  return [...DISPOSABLE_EMAIL_DOMAINS];
}
