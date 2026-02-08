import { MapsSearch } from "./class/MapsSearch.ts";
import { ExecutiveDashboard } from "./class/ExecutiveDashboard.ts";
import { GmailConnector } from "./class/GmailConnector.ts";
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

async function GetAllDataPost() {
  try {
    console.log("📡 Chargement des candidatures...");

    // Utiliser le client API avec interceptor (token automatiquement attaché)
    const result = await api.get<Application[]>('/applications');

    console.log("✅ Candidatures reçues:", result.data.length, "items");
    console.log("📊 Données:", result.data);

    // Render le dashboard
    executiveDashboard.render(result.data);
  } catch (error) {
    console.error("❌ ERREUR lors du chargement des candidatures:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
    // Si erreur 401/403, l'interceptor redirigera automatiquement
  }
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

    // Initialiser le connecteur Gmail
    new GmailConnector('gmailConnector');

    // Charger Google Maps au démarrage
    loadGoogleMapsScript();

    // Charger les données
    GetAllDataPost();
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
