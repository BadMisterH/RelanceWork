/**
 * utm-capture.js
 * Capture les paramètres UTM et le referrer dès l'arrivée sur la landing page.
 * Stocke les données dans localStorage pour les récupérer au moment de l'inscription.
 */

(function () {
  const STORAGE_KEY = 'rw_acquisition';

  // Ne pas écraser une valeur déjà sauvegardée (premier contact gagne)
  if (localStorage.getItem(STORAGE_KEY)) return;

  const params = new URLSearchParams(window.location.search);

  // Détection de la source depuis le referrer
  function detectSourceFromReferrer(referrer) {
    if (!referrer) return 'direct';
    try {
      const hostname = new URL(referrer).hostname.toLowerCase();
      if (hostname.includes('linkedin')) return 'linkedin';
      if (hostname.includes('google')) return 'google';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
      if (hostname.includes('facebook') || hostname.includes('fb.com')) return 'facebook';
      if (hostname.includes('instagram')) return 'instagram';
      if (hostname.includes('youtube')) return 'youtube';
      if (hostname.includes('reddit')) return 'reddit';
      return 'referral';
    } catch {
      return 'direct';
    }
  }

  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const referrer = document.referrer || '';

  const acquisition = {
    source: utmSource || detectSourceFromReferrer(referrer),
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    referrer_url: referrer || null,
    landing_url: window.location.href,
    captured_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(acquisition));
})();
