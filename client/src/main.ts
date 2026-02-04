import { UI } from "./class/Ui.ts";
import { MapsSearch } from "./class/MapsSearch.ts";
import "./style.css";
import "./styles/business-cards.css";
import axios from "axios";

// URL de base de ton API backend
const API_URL = "http://localhost:3000/api";

// Interface TypeScript pour typer les candidatures
export interface Application {
  id: number;
  company: string;
  poste: string;
  status: string;
  date: string;
  relanced: number; // 0 = false, 1 = true (SQLite boolean)
  relance_count: number; // Nombre de relances envoyées
  email?: string; // Adresse email du destinataire
  created_at?: string;
}

const affichage = new UI();

async function GetAllDataPost() {
  try {
    const result = await axios.get<Application[]>(`${API_URL}/applications`);
    affichage.getAffichage(result.data);
  } catch (error) {
    console.error("ERREUR AXIOS", error);
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

// Charger Google Maps au démarrage
loadGoogleMapsScript();

GetAllDataPost();

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
