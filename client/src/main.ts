import { MapsSearch } from "./class/MapsSearch.ts";
import { ExecutiveDashboard } from "./class/ExecutiveDashboard.ts";
import { GmailConnector } from "./class/GmailConnector.ts";
import { TemplateManager } from "./class/TemplateManager.ts";
import { AnalyticsDashboard } from "./class/AnalyticsDashboard.ts";
import "./style.css";
import api from "./lib/api";
import { supabase } from "./lib/supabase";

// Interface TypeScript pour typer les candidatures
export interface Application {
  id: number;
  company: string;
  poste: string;
  status: string;
  date: string;
  relanced: boolean; // Boolean maintenant (PostgreSQL)
  relance_count: number; // Nombre de relances envoyées
  email?: string; // Adresse email du destinataire
  user_email?: string; // Email de l'utilisateur
  created_at?: string;
  user_id?: string; // UUID de l'utilisateur (Supabase)
  company_website?: string; // Site web de l'entreprise
  company_description?: string; // Description enrichie de l'entreprise
}

// ============================================
// AUTH GUARD - Vérifier l'authentification
// ============================================
async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      console.warn("⚠️ Utilisateur non authentifié - redirection vers /auth.html");
      window.location.href = "/auth.html";
      return false;
    }

    console.log("✅ Utilisateur authentifié:", session.user.email);

    // Afficher les infos utilisateur dans le header
    updateUserProfile(session.user);

    return true;
  } catch (error) {
    console.error("❌ Erreur auth guard:", error);
    window.location.href = "/auth.html";
    return false;
  }
}

/**
 * Mettre à jour le profil utilisateur dans le header
 */
function updateUserProfile(user: any) {
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileAvatar = document.getElementById('profileAvatar');

  if (profileName && user.user_metadata?.name) {
    profileName.textContent = user.user_metadata.name;
  }

  if (profileEmail && user.email) {
    profileEmail.textContent = user.email;
  }

  if (profileAvatar && user.user_metadata?.name) {
    // Première lettre du nom en majuscule
    const initial = user.user_metadata.name.charAt(0).toUpperCase();
    profileAvatar.textContent = initial;
  } else if (profileAvatar && user.email) {
    // Sinon, première lettre de l'email
    const initial = user.email.charAt(0).toUpperCase();
    profileAvatar.textContent = initial;
  }
}

const executiveDashboard = new ExecutiveDashboard();
const templateManager = new TemplateManager();
const analyticsDashboard = new AnalyticsDashboard();
let currentApplications: Application[] = [];
let userPlan: 'free' | 'pro' = 'free';
let planLimits: {
  applications: { current: number; max: number; allowed: boolean };
  searches: { current: number; max: number; allowed: boolean };
} | null = null;

// ============================================
// BILLING - Vérifier le plan de l'utilisateur
// ============================================
async function checkBillingStatus() {
  try {
    const result = await api.get('/billing/status');
    userPlan = result.data.plan;
    planLimits = {
      applications: result.data.limits.applications,
      searches: result.data.limits.searches,
    };
    console.log(`💳 Plan: ${userPlan}`, planLimits);
    renderPlanBadge();
    renderUpgradeBanner();
  } catch (error) {
    console.error("Erreur billing status:", error);
  }
}

function renderPlanBadge() {
  const profileInfo = document.querySelector('.profile-info');
  if (!profileInfo) return;

  // Supprimer l'ancien badge s'il existe
  const oldBadge = document.getElementById('planBadge');
  if (oldBadge) oldBadge.remove();

  const badge = document.createElement('span');
  badge.id = 'planBadge';
  badge.className = userPlan === 'pro' ? 'plan-badge plan-badge--pro' : 'plan-badge plan-badge--free';
  badge.textContent = userPlan === 'pro' ? 'PRO' : 'FREE';

  if (userPlan === 'free') {
    badge.style.cursor = 'pointer';
    badge.title = 'Passer au plan Pro';
    badge.addEventListener('click', handleUpgrade);
  }

  profileInfo.appendChild(badge);
}

function renderUpgradeBanner() {
  const existing = document.getElementById('upgradeBanner');
  if (existing) existing.remove();

  if (userPlan === 'pro' || !planLimits) return;

  const { current, max, allowed } = planLimits.applications;
  const appPercentage = Math.round((current / max) * 100);
  const searchCurrent = planLimits.searches?.current || 0;
  const searchMax = planLimits.searches?.max || 15;
  const searchPercentage = Math.round((searchCurrent / searchMax) * 100);

  // Afficher la bannière si > 50% utilisé ou limite atteinte (candidatures ou recherches)
  if (appPercentage < 50 && searchPercentage < 50) return;

  // Déterminer quel message afficher
  const isBlocked = !allowed || !planLimits.searches?.allowed;
  const lines: string[] = [];
  if (appPercentage >= 50) lines.push(`${current}/${max} candidatures`);
  if (searchPercentage >= 50) lines.push(`${searchCurrent}/${searchMax} recherches`);

  const banner = document.createElement('div');
  banner.id = 'upgradeBanner';
  banner.className = `upgrade-banner ${isBlocked ? 'upgrade-banner--limit' : ''}`;
  banner.innerHTML = `
    <div class="upgrade-banner-content">
      <div class="upgrade-banner-info">
        <strong>${isBlocked ? 'Limite atteinte !' : 'Plan gratuit'}</strong>
        <span>${lines.join(' · ')}${isBlocked ? ' - Passez a Pro pour continuer' : ''}</span>
      </div>
      <div class="upgrade-banner-progress">
        <div class="upgrade-banner-bar" style="width: ${Math.min(Math.max(appPercentage, searchPercentage), 100)}%"></div>
      </div>
    </div>
    <button class="upgrade-banner-btn" id="upgradeBannerBtn">Passer a Pro</button>
  `;

  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) {
    dashboardContent.insertBefore(banner, dashboardContent.firstChild);
    document.getElementById('upgradeBannerBtn')?.addEventListener('click', handleUpgrade);
  }
}

async function handleUpgrade() {
  window.location.href = '/pricing.html';
}

async function GetAllDataPost() {
  try {
    console.log("📡 Chargement des candidatures...");

    const result = await api.get<Application[]>('/applications');

    console.log("✅ Candidatures reçues:", result.data.length, "items");

    currentApplications = result.data;
    executiveDashboard.render(result.data);
    analyticsDashboard.render(result.data);
  } catch (error) {
    console.error("❌ ERREUR lors du chargement des candidatures:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
  }
}

// ============================================
// GMAIL REFRESH - Rafraîchir les données après détection
// ============================================
window.addEventListener('gmail-refresh', () => {
  GetAllDataPost();
});

// ============================================
// RELANCE - Ouvrir le panneau de templates
// ============================================
window.addEventListener('relance-application', (e: Event) => {
  const { id } = (e as CustomEvent).detail;
  const app = currentApplications.find(a => a.id === id);
  if (!app) return;

  templateManager.open(app);
});

// ============================================
// RELANCE SENT - Incrémenter le compteur après envoi
// ============================================
window.addEventListener('relance-sent', async (e: Event) => {
  const { id } = (e as CustomEvent).detail;

  try {
    await api.put(`/applications/${id}/send-relance`);
  } catch (error) {
    console.error("Erreur lors de l'incrémentation de la relance:", error);
  }

  GetAllDataPost();
});

// ============================================
// SUPPRESSION
// ============================================
window.addEventListener('delete-application', async (e: Event) => {
  const { id } = (e as CustomEvent).detail;

  try {
    await api.delete(`/applications/${id}`);
    GetAllDataPost();
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
  }
});

// ============================================
// ENRICHISSEMENT ENTREPRISE
// ============================================
window.addEventListener('enrich-company', async (e: Event) => {
  const { id, website } = (e as CustomEvent).detail;
  if (!website) return;

  try {
    const result = await api.post('/company-enrichment/enrich', {
      url: website,
      applicationId: id,
    });

    if (result.data.success) {
      GetAllDataPost();
    }
  } catch (error) {
    console.error("Erreur lors de l'enrichissement:", error);
  }
});

// ============================================
// NAVIGATION DASHBOARD / ANALYTICS
// ============================================
function initViewNavigation() {
  const dashboardView = document.getElementById('applicationsList');
  const analyticsView = document.getElementById('analyticsList');
  const navBtns = document.querySelectorAll('.dash-nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = (btn as HTMLElement).dataset.view;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'analytics') {
        dashboardView?.setAttribute('style', 'display:none');
        analyticsView?.setAttribute('style', '');
      } else {
        dashboardView?.setAttribute('style', '');
        analyticsView?.setAttribute('style', 'display:none');
      }
    });
  });
}

// Instancier MapsSearch immédiatement pour que les événements soient attachés
const mapsSearch = new MapsSearch();

// Fonction globale pour initialiser Google Maps (appelée par le script Google Maps)
declare global {
  interface Window {
    initMap: () => void;
    mapsSearchInstance: MapsSearch;
    google?: any;
  }
}

window.mapsSearchInstance = mapsSearch;

// Fonction d'initialisation Google Maps
window.initMap = function() {
  console.log('✅ Google Maps script chargé, initialisation...');
  mapsSearch.onGoogleMapsLoaded();
};

// Charger le script Google Maps dynamiquement avec la clé API depuis .env
function loadGoogleMapsScript() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('❌ VITE_GOOGLE_MAPS_API_KEY non trouvée dans le fichier .env');
    console.error('Créez un fichier .env dans le dossier client/ avec :');
    console.error('VITE_GOOGLE_MAPS_API_KEY=votre_cle_api_ici');
    return;
  }

  console.log('🔑 Chargement de Google Maps avec la clé API depuis .env...');

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    console.error('❌ Erreur lors du chargement du script Google Maps');
    console.error('Vérifiez que :');
    console.error('1. Votre clé API est valide');
    console.error('2. Places API est activée dans Google Cloud Console');
    console.error('3. La facturation est configurée sur votre projet Google Cloud');
  };

  document.head.appendChild(script);
}

/**
 * Afficher la date actuelle dans le header
 */
function updateCurrentDate() {
  const dateElement = document.getElementById('currentDate');
  if (dateElement) {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    dateElement.textContent = now.toLocaleDateString('fr-FR', options);
  }
}

/**
 * Initialiser le mode sombre
 */
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  // Récupérer le thème sauvegardé ou utiliser la préférence système
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const defaultTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  // Appliquer le thème
  html.setAttribute('data-theme', defaultTheme);
  console.log(`🌙 Thème initial : ${defaultTheme}`);

  // Toggle au clic
  themeToggle?.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    console.log(`🌙 Thème changé : ${newTheme}`);
  });

  // Écouter les changements de préférence système
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      console.log(`🌙 Thème système changé : ${newTheme}`);
    }
  });
}

// Initialiser le thème AVANT de charger l'application pour éviter le flash
initThemeToggle();

// Vérifier l'authentification avant de charger l'application
checkAuth().then((isAuthenticated) => {
  if (isAuthenticated) {
    // Afficher la date
    updateCurrentDate();

    // Vérifier le plan de l'utilisateur
    checkBillingStatus();

    // Initialiser le connecteur Gmail
    new GmailConnector('gmailConnector');

    // Charger Google Maps au démarrage
    loadGoogleMapsScript();

    // Initialiser la navigation entre vues
    initViewNavigation();

    // Charger les données
    GetAllDataPost();

    // Vérifier si retour de Stripe Checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upgrade') === 'success') {
      setTimeout(() => {
        checkBillingStatus();
        window.history.replaceState({}, '', window.location.pathname);
      }, 1000);
    } else if (urlParams.get('upgrade') === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
});

// ============================================
// LOGOUT
// ============================================
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/auth.html';
});

// ============================================
// PROFILE - Modal de personnalisation
// ============================================
const PROFILE_STORAGE_KEY = 'relancework-user-profile';

interface UserProfile {
  name: string;
  title: string;
  phone: string;
  linkedin: string;
  signature: string;
}

function loadUserProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { name: '', title: '', phone: '', linkedin: '', signature: '' };
}

function saveUserProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  // Mettre à jour le header
  const profileName = document.getElementById('profileName');
  const profileAvatar = document.getElementById('profileAvatar');
  if (profile.name && profileName) {
    profileName.textContent = profile.name;
  }
  if (profile.name && profileAvatar) {
    profileAvatar.textContent = profile.name.charAt(0).toUpperCase();
  }
}

const profileBtn = document.getElementById('profileBtn');
const profileModalOverlay = document.getElementById('profileModalOverlay');

profileBtn?.addEventListener('click', () => {
  const profile = loadUserProfile();
  // Pré-remplir avec le nom du header si pas encore défini
  if (!profile.name) {
    profile.name = document.getElementById('profileName')?.textContent?.trim() || '';
  }

  (document.getElementById('profileInputName') as HTMLInputElement).value = profile.name;
  (document.getElementById('profileInputTitle') as HTMLInputElement).value = profile.title;
  (document.getElementById('profileInputPhone') as HTMLInputElement).value = profile.phone;
  (document.getElementById('profileInputLinkedin') as HTMLInputElement).value = profile.linkedin;
  (document.getElementById('profileInputSignature') as HTMLTextAreaElement).value = profile.signature;

  profileModalOverlay?.classList.add('active');
});

document.getElementById('closeProfileModal')?.addEventListener('click', () => {
  profileModalOverlay?.classList.remove('active');
});

profileModalOverlay?.addEventListener('click', (e) => {
  if (e.target === profileModalOverlay) profileModalOverlay.classList.remove('active');
});

document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
  const profile: UserProfile = {
    name: (document.getElementById('profileInputName') as HTMLInputElement).value.trim(),
    title: (document.getElementById('profileInputTitle') as HTMLInputElement).value.trim(),
    phone: (document.getElementById('profileInputPhone') as HTMLInputElement).value.trim(),
    linkedin: (document.getElementById('profileInputLinkedin') as HTMLInputElement).value.trim(),
    signature: (document.getElementById('profileInputSignature') as HTMLTextAreaElement).value.trim(),
  };
  saveUserProfile(profile);
  profileModalOverlay?.classList.remove('active');
});

// ============================================
// BILLING - Gérer l'abonnement
// ============================================
const billingBtn = document.getElementById('billingBtn');
billingBtn?.addEventListener('click', async () => {
  if (userPlan === 'pro') {
    // Ouvrir le portail Stripe pour gérer l'abonnement
    try {
      const result = await api.post('/billing/portal');
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error("Erreur portail billing:", error);
      // Si pas d'abonnement, proposer l'upgrade
      handleUpgrade();
    }
  } else {
    handleUpgrade();
  }
});

// ============================================
// SIDEBAR TOGGLE FUNCTIONALITY
// ============================================

const appWrapper = document.querySelector('.app-wrapper') as HTMLElement;
const sidebarToggleBtn = document.getElementById('sidebarToggle');

// Restore sidebar state from localStorage (default: collapsed)
const sidebarPref = localStorage.getItem('relancework-sidebar');
if (sidebarPref === 'open' && appWrapper) {
  appWrapper.classList.remove('sidebar-collapsed');
}

sidebarToggleBtn?.addEventListener('click', () => {
  if (!appWrapper) return;
  appWrapper.classList.toggle('sidebar-collapsed');
  const isCollapsed = appWrapper.classList.contains('sidebar-collapsed');
  localStorage.setItem('relancework-sidebar', isCollapsed ? 'collapsed' : 'open');
});

// ============================================
// MOBILE MENU FUNCTIONALITY
// ============================================

const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileOverlay = document.getElementById('mobileOverlay');
const sidebar = document.querySelector('.sidebar') as HTMLElement;

function toggleMobileMenu() {
  mobileMenuToggle?.classList.toggle('active');
  mobileOverlay?.classList.toggle('active');
  sidebar?.classList.toggle('active');

  // Prevent body scroll when menu is open
  if (sidebar?.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Toggle menu on button click
mobileMenuToggle?.addEventListener('click', toggleMobileMenu);

// Close menu when clicking overlay
mobileOverlay?.addEventListener('click', toggleMobileMenu);

// Close menu when clicking nav items (mobile)
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 768 && sidebar?.classList.contains('active')) {
      toggleMobileMenu();
    }
  });
});

// Close menu on window resize if going to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768 && sidebar?.classList.contains('active')) {
    toggleMobileMenu();
  }
});
