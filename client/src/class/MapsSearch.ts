/// <reference types="google.maps" />

import api from "../lib/api";

export interface BusinessPlace {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  placeId: string;
  location: {
    lat: number;
    lng: number;
  };
  types?: string[];
  rating?: number;
  isFavorite?: boolean;
  emailFoundViaHunter?: boolean;
}

export class MapsSearch {
  private map: google.maps.Map | null = null;
  private service: google.maps.places.PlacesService | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private currentResults: BusinessPlace[] = [];
  private googleMapsLoaded: boolean = false;
  private userLocation: { lat: number; lng: number } | null = null;
  private searchUsage: { current: number; max: number; allowed: boolean } | null = null;
  private favorites: Set<string> = new Set();
  private STORAGE_KEY = 'relancework_favorites';
  private CACHE_KEY = 'relancework_cached_businesses';
  private mapsErrorMessage: string | null = null;
  private defaultBadgeHtml: string | null = null;
  private defaultSearchPlaceholder: string | null = null;

  // Requêtes de recherche ciblées sur les entreprises tech/web qui recrutent
  private techSearchQueries = [
    "agence web",              // Agences web / digitales
    "agence digitale",         // Agences digitales
    "startup tech",            // Startups tech
    "développement informatique", // SSII / ESN
    "ESN informatique",        // Entreprises de services numériques
    "agence communication digitale", // Agences de com digitale
    "éditeur logiciel",        // Éditeurs de logiciels
    "studio développement web", // Studios dev
  ];

  constructor() {
    // Attacher les événements immédiatement (pas besoin de Google Maps pour ça)
    this.loadFavorites(); // Charger favoris de manière asynchrone
    this.initEvents();
  }

  /**
   * Charger les favoris depuis le backend
   */
  private async loadFavorites() {
    try {
      // Charger depuis le backend
      const response = await api.get('/favorites');
      const favoritePlaceIds = response.data.map((fav: any) => fav.placeId);
      this.favorites = new Set(favoritePlaceIds);
      console.log(`✅ ${this.favorites.size} favoris chargés depuis le backend`);

      // Sauvegarder dans localStorage pour synchro locale
      this.saveFavorites();
    } catch (error: any) {
      console.error('Erreur lors du chargement des favoris depuis le backend:', error);

      // Fallback sur localStorage en cas d'erreur
      try {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          this.favorites = new Set(JSON.parse(saved));
          console.log(`✅ ${this.favorites.size} favoris chargés depuis localStorage (fallback)`);
        }
      } catch (e) {
        console.error('Erreur lors du chargement des favoris depuis localStorage:', e);
        this.favorites = new Set();
      }
    }
  }

  /**
   * Sauvegarder les favoris dans localStorage
   */
  private saveFavorites() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this.favorites]));
      console.log(`💾 ${this.favorites.size} favoris sauvegardés`);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des favoris:', error);
    }
  }

  /**
   * Mettre en cache les données des entreprises pour la page favoris
   */
  private cacheBusinessData() {
    try {
      console.log(`💾 Mise en cache de ${this.currentResults.length} résultats actuels`);

      // Charger le cache existant
      const existingCache = localStorage.getItem(this.CACHE_KEY);
      let cachedBusinesses: BusinessPlace[] = existingCache ? JSON.parse(existingCache) : [];

      console.log(`💾 Cache existant: ${cachedBusinesses.length} entreprises`);

      // Fusionner les nouvelles données avec le cache existant
      this.currentResults.forEach(business => {
        const existingIndex = cachedBusinesses.findIndex(b => b.placeId === business.placeId);
        if (existingIndex >= 0) {
          // Mettre à jour l'entrée existante
          console.log(`♻️ Mise à jour du cache pour: ${business.name} (${business.placeId})`);
          cachedBusinesses[existingIndex] = business;
        } else {
          // Ajouter nouvelle entrée
          console.log(`➕ Ajout au cache: ${business.name} (${business.placeId})`);
          cachedBusinesses.push(business);
        }
      });

      // Limiter le cache à 500 entreprises max pour ne pas surcharger localStorage
      if (cachedBusinesses.length > 500) {
        cachedBusinesses = cachedBusinesses.slice(-500);
      }

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cachedBusinesses));
      console.log(`✅ ${cachedBusinesses.length} entreprises en cache total`);
    } catch (error) {
      console.error('Erreur lors de la mise en cache des entreprises:', error);
    }
  }

  /**
   * Basculer l'état favori d'une entreprise
   */
  private async toggleFavorite(placeId: string) {
    const wasAdded = !this.favorites.has(placeId);
    const business = this.currentResults.find(b => b.placeId === placeId);

    if (!business) {
      console.error('Business non trouvé:', placeId);
      return;
    }

    try {
      if (this.favorites.has(placeId)) {
        // Supprimer du backend
        await api.delete(`/favorites/${placeId}`);
        this.favorites.delete(placeId);
        business.isFavorite = false;
        console.log(`💔 Retiré des favoris (backend): ${placeId}`);
      } else {
        // Ajouter au backend
        await api.post('/favorites', {
          placeId: business.placeId,
          businessData: business
        });
        this.favorites.add(placeId);
        business.isFavorite = true;
        console.log(`❤️ Ajouté aux favoris (backend): ${placeId}`);
      }

      // Mettre à jour localStorage pour synchro locale
      this.saveFavorites();

      // Forcer la mise en cache immédiate quand un favori est ajouté
      if (wasAdded && this.currentResults.length > 0) {
        console.log('💾 Mise en cache forcée après ajout favori');
        this.cacheBusinessData();
      }

      // Émettre un événement pour notifier que les favoris ont été mis à jour
      window.dispatchEvent(new CustomEvent('favorites-updated'));

      // Rafraîchir l'affichage
      this.applyFilters();
    } catch (error: any) {
      console.error('❌ Erreur lors de la mise à jour du favori:', error);
      if (error.response?.status === 401) {
        (window as any).showToast?.('warning', 'Connectez-vous pour ajouter des favoris');
      } else {
        (window as any).showToast?.('error', 'Erreur lors de la mise à jour du favori');
      }
    }
  }

  // Méthode appelée quand Google Maps API est chargée
  public onGoogleMapsLoaded() {
    this.googleMapsLoaded = true;
    this.mapsErrorMessage = null;
    this.updateMapsAvailabilityUI();
    this.initMap();
    console.log('Google Maps initialisé et prêt');
    // La recherche automatique sera lancée quand le modal s'ouvre
  }

  public setMapsUnavailable(message: string) {
    this.mapsErrorMessage = message;
    this.googleMapsLoaded = false;
    this.updateMapsAvailabilityUI();
  }

  private updateMapsAvailabilityUI() {
    const searchBtn = document.getElementById("mapsSearchBtn") as HTMLButtonElement | null;
    const searchInput = document.getElementById("mapsSearchInput") as HTMLInputElement | null;
    const badge = document.querySelector(".search-status-badge") as HTMLElement | null;
    const controls = document.querySelector(".panel-search-controls") as HTMLElement | null;
    const resultsContainer = document.getElementById("businessResults");

    if (badge && !this.defaultBadgeHtml) {
      this.defaultBadgeHtml = badge.innerHTML;
    }
    if (searchInput && !this.defaultSearchPlaceholder) {
      this.defaultSearchPlaceholder = searchInput.placeholder;
    }

    if (this.mapsErrorMessage) {
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.classList.add("maps-disabled");
      }
      if (searchInput) {
        searchInput.disabled = true;
        searchInput.classList.add("maps-disabled");
        searchInput.placeholder = "Google Maps non configuré";
      }
      if (badge) {
        badge.classList.add("search-status-badge--error");
        badge.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v6h-2V7h2zm0 8v2h-2v-2h2z"/>
          </svg>
          <span>Recherche automatique indisponible</span>
        `;
      }

      if (controls) {
        let notice = document.getElementById("mapsConfigNotice");
        if (!notice) {
          notice = document.createElement("div");
          notice.id = "mapsConfigNotice";
          notice.className = "maps-config-notice";
          const badgeEl = controls.querySelector(".search-status-badge");
          if (badgeEl && badgeEl.parentNode) {
            badgeEl.parentNode.insertBefore(notice, badgeEl.nextSibling);
          } else {
            controls.prepend(notice);
          }
        }
        notice.innerHTML = `
          <strong>Google Maps indisponible</strong>
          <span>${this.mapsErrorMessage}</span>
        `;
      }

      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="panel-empty-state" data-maps-unavailable="1">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="32" height="32">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h4>Google Maps non configuré</h4>
            <p>${this.mapsErrorMessage}</p>
          </div>
        `;
      }
      return;
    }

    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.classList.remove("maps-disabled");
    }
    if (searchInput) {
      searchInput.disabled = false;
      searchInput.classList.remove("maps-disabled");
      if (this.defaultSearchPlaceholder) {
        searchInput.placeholder = this.defaultSearchPlaceholder;
      }
    }
    if (badge) {
      badge.classList.remove("search-status-badge--error");
      if (this.defaultBadgeHtml) {
        badge.innerHTML = this.defaultBadgeHtml;
      }
    }

    const notice = document.getElementById("mapsConfigNotice");
    notice?.remove();

    if (resultsContainer) {
      const hasUnavailable = resultsContainer.querySelector("[data-maps-unavailable]");
      if (hasUnavailable) {
        resultsContainer.innerHTML = `
          <div class="panel-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h4>Aucun résultat pour le moment</h4>
            <p>Recherche automatique des entreprises tech/web en cours...</p>
          </div>
        `;
      }
    }
  }

  private initMap() {
    console.log('Initialisation de la carte Google Maps...');
    const mapElement = document.getElementById("map");
    if (!mapElement) {
      console.error('❌ Element "map" non trouvé dans le DOM');
      return;
    }

    // Centre par défaut sur Paris
    const defaultCenter = { lat: 48.8566, lng: 2.3522 };

    this.map = new google.maps.Map(mapElement, {
      center: defaultCenter,
      zoom: 13,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    });

    this.service = new google.maps.places.PlacesService(this.map);
    this.infoWindow = new google.maps.InfoWindow();

    console.log('✅ Carte, service Places et InfoWindow initialisés');
  }

  // Détecter la localisation de l'utilisateur et lancer la recherche automatique
  private async startAutoSearch() {
    console.log("🚀 Démarrage de la recherche automatique...");

    // Vérifier la limite de recherche
    const allowed = await this.checkSearchLimit();
    if (!allowed) return;

    // Demander la géolocalisation
    if (navigator.geolocation) {
      console.log('Demande de géolocalisation...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          console.log('✅ Position obtenue:', this.userLocation);

          // Centrer la carte sur la position de l'utilisateur
          if (this.map) {
            this.map.setCenter(this.userLocation);
            this.map.setZoom(14);
            console.log('Carte centrée sur la position utilisateur');
          }

          // Lancer la recherche automatique
          this.performAutoSearch();
        },
        (error) => {
          console.warn("⚠️ Géolocalisation refusée:", error.message);
          console.log("Utilisation de la position par défaut (Paris)");
          // Utiliser Paris par défaut
          this.userLocation = { lat: 48.8566, lng: 2.3522 };
          if (this.map) {
            this.map.setCenter(this.userLocation);
            this.map.setZoom(14);
          }
          this.performAutoSearch();
        }
      );
    } else {
      console.warn("⚠️ Géolocalisation non supportée par le navigateur");
      this.userLocation = { lat: 48.8566, lng: 2.3522 };
      if (this.map) {
        this.map.setCenter(this.userLocation);
        this.map.setZoom(14);
      }
      this.performAutoSearch();
    }
  }

  // Effectuer la recherche automatique avec textSearch ciblé tech/web
  private async performAutoSearch() {
    console.log('performAutoSearch appelé', {
      googleMapsLoaded: this.googleMapsLoaded,
      service: !!this.service,
      map: !!this.map,
      userLocation: this.userLocation
    });

    if (!this.googleMapsLoaded || !this.service || !this.map || !this.userLocation) {
      console.error('Conditions non remplies pour la recherche automatique');
      return;
    }

    const resultsContainer = document.getElementById("businessResults");
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="panel-empty-state">
          <div style="width: 80px; height: 80px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <h4 style="margin-top: 20px;">Recherche en cours...</h4>
          <p>Détection des entreprises tech/web autour de vous</p>
          <p style="font-size: 0.875rem; margin-top: 8px; color: #94a3b8;">Recherche par catégories...</p>
        </div>
      `;
    }

    console.log(`🎯 Recherche ciblée sur ${this.techSearchQueries.length} catégories tech/web`);

    try {
      const allResults: google.maps.places.PlaceResult[] = [];

      // Prendre les 4 premières requêtes pour varier les résultats
      const queriesToSearch = this.techSearchQueries.slice(0, 4);

      for (let i = 0; i < queriesToSearch.length; i++) {
        const query = queriesToSearch[i]!;
        console.log(`🔍 Recherche ${i + 1}/${queriesToSearch.length}: "${query}"`);

        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="panel-empty-state">
              <div style="width: 80px; height: 80px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <h4 style="margin-top: 20px;">Recherche en cours...</h4>
              <p>"${query}" (${i + 1}/${queriesToSearch.length})</p>
              <p style="font-size: 0.875rem; margin-top: 8px; color: #94a3b8;">${allResults.length} entreprises trouvées</p>
            </div>
          `;
        }

        const queryResults = await this.textSearchWithLocation(query);
        console.log(`  ✅ ${queryResults.length} résultats pour "${query}"`);

        // Ajouter les résultats en évitant les doublons (par place_id)
        const existingIds = new Set(allResults.map(r => r.place_id));
        const newResults = queryResults.filter(r => !existingIds.has(r.place_id));
        allResults.push(...newResults);

        // Pause entre les requêtes pour respecter les limites de l'API
        if (i < queriesToSearch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Total: ${allResults.length} entreprises tech/web trouvées`);

      // Incrémenter le compteur de recherche
      await this.trackSearch();

      if (allResults.length > 0) {
        this.handleSearchResults(allResults);
      } else {
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="panel-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="4" y1="4" x2="20" y2="20" stroke-width="2"/>
              </svg>
              <h4>Aucune entreprise trouvée</h4>
              <p>Essayez d'élargir la zone ou effectuez une recherche manuelle</p>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Erreur lors de la recherche ciblée:', error);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="panel-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h4>Erreur lors de la recherche</h4>
            <p>Essayez une recherche manuelle</p>
          </div>
        `;
      }
    }
  }

  // Recherche textSearch avec localisation de l'utilisateur
  private textSearchWithLocation(query: string): Promise<google.maps.places.PlaceResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.service || !this.userLocation) {
        reject(new Error('Service Places ou localisation non disponible'));
        return;
      }

      const request: google.maps.places.TextSearchRequest = {
        query: query,
        location: this.userLocation,
        radius: 10000, // 10km pour les entreprises tech (plus large que les artisans)
      };

      this.service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          console.error(`Erreur textSearch pour "${query}":`, status);
          resolve([]); // Ne pas bloquer les autres recherches
        }
      });
    });
  }

  private initEvents() {
    const searchBtn = document.getElementById("mapsSearchBtn");
    const searchInput = document.getElementById("mapsSearchInput") as HTMLInputElement;
    const closeBtn = document.getElementById("closeSearchModalBtn");
    const quickSearchBtn = document.getElementById("quickSearchBtn");
    const modal = document.getElementById("searchModal");

    if (quickSearchBtn && modal) {
      quickSearchBtn.addEventListener("click", () => {
        console.log('Ouverture du modal de recherche');
        modal.classList.add("active");

        if (this.mapsErrorMessage) {
          this.updateMapsAvailabilityUI();
        }

        // Afficher le compteur si on a des données
        if (this.searchUsage) {
          this.renderSearchCounter();
        }

        // Déclencher la recherche automatique quand le modal s'ouvre
        if (this.googleMapsLoaded && !this.userLocation) {
          console.log('Lancement de la recherche automatique...');
          this.startAutoSearch();
        } else if (this.userLocation && this.currentResults.length === 0) {
          console.log('Position déjà connue, relancement de la recherche...');
          this.startAutoSearch();
        }
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }

    // Close on click outside (overlay)
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      });
    }

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("active")) {
        modal.classList.remove("active");
      }
    });

    if (searchBtn && searchInput) {
      searchBtn.addEventListener("click", () => {
        const query = searchInput.value.trim();
        if (query) {
          this.searchPlaces(query);
        }
      });

      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const query = searchInput.value.trim();
          if (query) {
            this.searchPlaces(query);
          }
        }
      });
    }

    // Filtres
    const filterNoWebsite = document.getElementById("filterNoWebsite") as HTMLInputElement;
    const filterNoEmail = document.getElementById("filterNoEmail") as HTMLInputElement;
    const filterWithEmail = document.getElementById("filterWithEmail") as HTMLInputElement;
    const filterFavorites = document.getElementById("filterFavorites") as HTMLInputElement;

    // Helper function to toggle filter chip active class
    const toggleFilterChipClass = (checkbox: HTMLInputElement) => {
      const chip = checkbox.closest('.filter-chip');
      if (chip) {
        if (checkbox.checked) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      }
    };

    if (filterNoWebsite) {
      filterNoWebsite.addEventListener("change", () => {
        toggleFilterChipClass(filterNoWebsite);
        this.applyFilters();
      });
    }

    if (filterNoEmail) {
      filterNoEmail.addEventListener("change", () => {
        toggleFilterChipClass(filterNoEmail);
        this.applyFilters();
      });
    }

    if (filterWithEmail) {
      filterWithEmail.addEventListener("change", () => {
        toggleFilterChipClass(filterWithEmail);
        this.applyFilters();
      });
    }

    if (filterFavorites) {
      filterFavorites.addEventListener("change", () => {
        toggleFilterChipClass(filterFavorites);
        this.applyFilters();
      });
    }
  }

  private async searchPlaces(query: string) {
    console.log('🔍 Recherche manuelle:', query);

    // Vérifier la limite de recherche
    const allowed = await this.checkSearchLimit();
    if (!allowed) return;

    const resultsContainer = document.getElementById("businessResults");

    // Vérifier si Google Maps est chargé
    if (!this.googleMapsLoaded || !this.service || !this.map) {
      console.error('Google Maps non chargé ou service indisponible');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="error-text">
            <p style="margin-bottom: 12px;">⚠️ Google Maps n'est pas configuré</p>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">
              Ajoutez <strong>VITE_GOOGLE_MAPS_API_KEY</strong> dans votre environnement, puis redeployez.
            </p>
          </div>
        `;
      }
      return;
    }

    // Afficher un loader
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="panel-empty-state">
          <div style="width: 80px; height: 80px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <h4 style="margin-top: 20px;">Recherche en cours...</h4>
        </div>
      `;
    }

    // Utiliser l'API Text Search pour une recherche plus flexible
    const request: google.maps.places.TextSearchRequest = {
      query: query,
      // Optionnel: ajouter une localisation
    };

    console.log('Lancement textSearch avec:', request);

    this.service.textSearch(request, (results, status) => {
      console.log('textSearch réponse:', { status, resultCount: results?.length });

      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        console.log(`✅ ${results.length} résultats trouvés pour "${query}"`);
        this.trackSearch();
        this.handleSearchResults(results);
      } else {
        console.error('Erreur textSearch:', status);
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="panel-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="4" y1="4" x2="20" y2="20" stroke-width="2"/>
              </svg>
              <h4>Aucun résultat trouvé</h4>
              <p>Status: ${status}</p>
            </div>
          `;
        }
      }
    });
  }

  private async handleSearchResults(results: google.maps.places.PlaceResult[]) {
    console.log(`📋 Traitement de ${results.length} résultats...`);

    // Nettoyer les marqueurs précédents
    this.clearMarkers();

    // Réinitialiser les résultats
    this.currentResults = [];

    // Traiter chaque résultat pour obtenir les détails
    console.log('Récupération des détails pour chaque entreprise...');
    const detailPromises = results.map((result) => this.getPlaceDetails(result.place_id!));
    const detailedResults = await Promise.all(detailPromises);

    // Filtrer les résultats null
    this.currentResults = detailedResults.filter((r) => r !== null) as BusinessPlace[];
    console.log(`✅ ${this.currentResults.length} entreprises avec détails récupérés`);

    // Log du nombre d'entreprises sans site web
    const noWebsiteCount = this.currentResults.filter(r => !r.website).length;
    console.log(`📊 Entreprises sans site web: ${noWebsiteCount}/${this.currentResults.length}`);

    // Appliquer les filtres
    this.applyFilters();

    // Ajuster la carte pour afficher tous les marqueurs
    if (this.currentResults.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      this.currentResults.forEach((result) => {
        bounds.extend(new google.maps.LatLng(result.location.lat, result.location.lng));
      });
      this.map?.fitBounds(bounds);
      console.log('Carte ajustée pour afficher tous les résultats');
    }
  }

  private async getPlaceDetails(placeId: string): Promise<BusinessPlace | null> {
    return new Promise((resolve) => {
      if (!this.service) {
        resolve(null);
        return;
      }

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "website",
          "geometry",
          "types",
          "rating",
          "business_status",
        ],
      };

      this.service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const business: BusinessPlace = {
            name: place.name || "Sans nom",
            address: place.formatted_address || "Adresse non disponible",
            phone: place.formatted_phone_number,
            website: place.website,
            placeId: placeId,
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            types: place.types,
            rating: place.rating,
            isFavorite: this.favorites.has(placeId),
            emailFoundViaHunter: false,
          };
          resolve(business);
        } else {
          resolve(null);
        }
      });
    });
  }

  private applyFilters() {
    const filterNoWebsite = document.getElementById("filterNoWebsite") as HTMLInputElement;
    const filterNoEmail = document.getElementById("filterNoEmail") as HTMLInputElement;
    const filterWithEmail = document.getElementById("filterWithEmail") as HTMLInputElement;
    const filterFavorites = document.getElementById("filterFavorites") as HTMLInputElement;

    console.log('🔍 Application des filtres:', {
      filterNoWebsite: filterNoWebsite?.checked,
      filterNoEmail: filterNoEmail?.checked,
      filterWithEmail: filterWithEmail?.checked,
      filterFavorites: filterFavorites?.checked,
      totalResults: this.currentResults.length
    });

    let filteredResults = [...this.currentResults];

    if (filterNoWebsite?.checked) {
      filteredResults = filteredResults.filter((r) => !r.website);
      console.log(`Filtre sans site web: ${filteredResults.length} résultats`);
    }

    if (filterNoEmail?.checked) {
      filteredResults = filteredResults.filter((r) => !r.email);
      console.log(`Filtre sans email: ${filteredResults.length} résultats`);
    }

    if (filterWithEmail?.checked) {
      filteredResults = filteredResults.filter((r) => r.email);
      console.log(`Filtre avec email: ${filteredResults.length} résultats`);
    }

    if (filterFavorites?.checked) {
      filteredResults = filteredResults.filter((r) => this.favorites.has(r.placeId));
      console.log(`Filtre favoris: ${filteredResults.length} résultats`);
    }

    console.log(`📊 Résultats après filtres: ${filteredResults.length}`);
    this.displayResults(filteredResults);
  }

  private displayResults(results: BusinessPlace[]) {
    console.log(`🎨 Affichage de ${results.length} résultats`);

    // Mettre en cache les données pour la page favoris
    this.cacheBusinessData();

    const resultsContainer = document.getElementById("businessResults");
    const resultsCount = document.getElementById("resultsCount");

    if (resultsCount) {
      resultsCount.textContent = `${results.length}`;
    }

    if (!resultsContainer) {
      console.error('❌ Container "businessResults" non trouvé');
      return;
    }

    if (results.length === 0) {
      console.log('Aucun résultat à afficher');
      resultsContainer.innerHTML = `
        <div class="panel-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
          </svg>
          <h4>Aucune entreprise trouvée</h4>
          <p>Aucune entreprise ne correspond aux filtres sélectionnés</p>
        </div>
      `;
      this.clearMarkers();
      return;
    }

    console.log('Génération du HTML pour les résultats...');

    // Nettoyer les marqueurs et en créer de nouveaux
    this.clearMarkers();

    // Compter les entreprises sans email
    const noEmailCount = results.filter(r => !r.email).length;

    // Ajouter un bouton d'enrichissement si des entreprises n'ont pas d'email
    const enrichButton = noEmailCount > 0 ? `
      <div class="enrich-section" style="margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 12px; border: 2px solid rgba(99, 102, 241, 0.2); backdrop-filter: blur(10px);">
        <button class="btn-enrich-emails" id="btnEnrichEmails" style="width: 100%; padding: 16px 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 100%); pointer-events: none;"></div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 22px; height: 22px; position: relative; z-index: 1;">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
            <circle cx="18" cy="8" r="3" fill="currentColor" opacity="0.3"/>
          </svg>
          <span style="position: relative; z-index: 1;">
            Enrichir avec Hunter.io
            <span style="display: inline-block; margin-left: 8px; padding: 4px 10px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 12px; font-weight: 700;">${noEmailCount}</span>
          </span>
        </button>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-size: 13px; color: #6366f1; font-weight: 500;">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>Emails professionnels vérifiés • Plan gratuit: 25/mois</span>
        </div>
      </div>
    ` : '';

    resultsContainer.innerHTML = enrichButton + results
      .map(
        (business, index) => {
          let domain = '';
          if (business.website) {
            try { domain = new URL(business.website).hostname.replace('www.', ''); } catch { /* ignore */ }
          }

          const isFavorite = this.favorites.has(business.placeId);
          const hasHunterEmail = business.emailFoundViaHunter === true;

          return `
      <div class="business-card ${isFavorite ? 'is-favorite' : ''} ${hasHunterEmail ? 'has-hunter-email' : ''}" data-index="${index}" data-place-id="${business.placeId}">
        ${hasHunterEmail ? '<div class="hunter-badge" title="Email trouvé via Hunter.io">🎯 Hunter.io</div>' : ''}
        <div class="biz-top">
          <div class="biz-avatar">${business.name.charAt(0).toUpperCase()}</div>
          <div class="biz-identity">
            <h4 class="biz-name">${business.name}</h4>
            <span class="biz-address">${business.address}</span>
          </div>
          ${business.rating ? `<span class="biz-rating">${business.rating}</span>` : ''}
          <button class="biz-favorite-btn ${isFavorite ? 'active' : ''}" data-place-id="${business.placeId}" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <svg viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        <div class="biz-tags">
          ${business.website
            ? `<a href="${business.website}" target="_blank" rel="noopener" class="biz-tag biz-tag--site">${domain}</a>`
            : `<span class="biz-tag biz-tag--nosite">Pas de site web</span>`}
          ${business.phone
            ? `<span class="biz-tag biz-tag--phone">${business.phone}</span>`
            : ''}
          ${business.email
            ? `<span class="biz-tag biz-tag--email ${hasHunterEmail ? 'hunter-email' : ''}">${business.email}</span>`
            : `<span class="biz-tag biz-tag--noemail">Pas d'email</span>`}
        </div>

        <div class="biz-actions">
          <button class="biz-btn biz-btn--map" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Localiser
          </button>
          ${business.website
            ? `<a href="${business.website}" target="_blank" rel="noopener" class="biz-btn biz-btn--visit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Visiter le site
              </a>`
            : ''}
        </div>
      </div>
    `;
        }
      )
      .join("");

    // Créer les marqueurs
    results.forEach((business, index) => {
      this.createMarker(business, index);
    });

    // Attacher les événements
    this.attachResultEvents(results);

    // Attacher l'événement au bouton d'enrichissement
    if (noEmailCount > 0) {
      const enrichBtn = document.getElementById("btnEnrichEmails");
      if (enrichBtn) {
        enrichBtn.addEventListener("click", () => this.enrichWithEmails(results));
      }
    }
  }

  private createMarker(business: BusinessPlace, index: number) {
    if (!this.map) return;

    const marker = new google.maps.Marker({
      position: business.location,
      map: this.map,
      title: business.name,
      label: String(index + 1),
    });

    marker.addListener("click", () => {
      this.showInfoWindow(marker, business);
    });

    this.markers.push(marker);
  }

  private showInfoWindow(marker: google.maps.Marker, business: BusinessPlace) {
    if (!this.infoWindow) return;

    const content = `
      <div class="info-window">
        <h3>${business.name}</h3>
        <p>${business.address}</p>
        ${business.phone ? `<p>📞 ${business.phone}</p>` : ""}
        ${business.website ? `<p>🌐 <a href="${business.website}" target="_blank">Site web</a></p>` : "<p>❌ Pas de site web</p>"}
      </div>
    `;

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map!, marker);
  }

  private attachResultEvents(results: BusinessPlace[]) {
    // Boutons "Localiser"
    document.querySelectorAll(".biz-btn--map").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const index = parseInt(target.getAttribute("data-index") || "0");
        const business = results[index];
        if (business && this.map) {
          this.map.setCenter(business.location);
          this.map.setZoom(16);
          const marker = this.markers[index];
          if (marker) {
            this.showInfoWindow(marker, business);
          }
          // Scroll vers la carte sur mobile
          const mapEl = document.getElementById('map');
          mapEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    // Boutons "Favori"
    document.querySelectorAll(".biz-favorite-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLButtonElement;
        const placeId = target.getAttribute("data-place-id");
        if (placeId) {
          this.toggleFavorite(placeId);
        }
      });
    });
  }

  /**
   * Enrichir les résultats avec les emails via Hunter.io
   */
  private async enrichWithEmails(results: BusinessPlace[]) {
    // Filtrer les entreprises sans email
    const businessesWithoutEmail = results.filter(b => !b.email);

    if (businessesWithoutEmail.length === 0) {
      (window as any).showToast?.('info', 'Toutes les entreprises ont déjà un email !');
      return;
    }

    console.log(`🤖 Enrichissement de ${businessesWithoutEmail.length} entreprises avec Hyperbrowser...`);

    // Mettre à jour le bouton pour afficher l'état de chargement
    const enrichBtn = document.getElementById("btnEnrichEmails");
    if (enrichBtn) {
      enrichBtn.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center;">
          <div style="width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div>
          Recherche en cours... (0/${businessesWithoutEmail.length})
        </div>
      `;
      (enrichBtn as HTMLButtonElement).disabled = true;
      (enrichBtn as HTMLButtonElement).style.cursor = 'not-allowed';
      (enrichBtn as HTMLButtonElement).style.opacity = '0.7';
    }

    try {
      // Préparer les données pour l'API
      const companies = businessesWithoutEmail.map(b => ({
        name: b.name,
        location: b.address
      }));

      // Appeler l'API batch pour enrichir les emails via Hunter.io
      // Utiliser le client API avec token automatique
      const response = await api.post('/email-enrichment/find-emails-batch', {
        companies,
        maxConcurrent: 2 // 2 recherches en parallèle pour Hunter.io
      });

      const data = response.data;
      console.log("📧 Résultats Hyperbrowser:", data);

      // Mettre à jour les résultats avec les emails trouvés
      let emailsFound = 0;
      data.data.forEach((result: { companyName: string; emails: string[] }) => {
        const business = this.currentResults.find(b => b.name === result.companyName);
        if (business && result.emails.length > 0) {
          business.email = result.emails[0]; // Prendre le premier email
          business.emailFoundViaHunter = true; // Marquer comme trouvé via Hunter.io
          emailsFound++;
        }
      });

      console.log(`✅ ${emailsFound} email(s) trouvé(s) sur ${businessesWithoutEmail.length} entreprises`);

      // Mettre à jour le cache avec les nouveaux emails
      this.cacheBusinessData();

      // Rafraîchir l'affichage
      this.applyFilters();

      // Afficher un message de succès
      (window as any).showToast?.('success', `${emailsFound} email(s) trouvé(s) sur ${businessesWithoutEmail.length} entreprises`, 5000);
    } catch (error) {
      console.error("❌ Erreur lors de l'enrichissement:", error);
      (window as any).showToast?.('error', `Erreur lors de l'enrichissement. Vérifiez votre clé API Hunter.io.`, 5000);

      // Restaurer le bouton
      if (enrichBtn) {
        enrichBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; margin-right: 8px;">
            <path d="M4 4h16c1.1 0 2 .9 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Enrichir avec emails (${businessesWithoutEmail.length} entreprise${businessesWithoutEmail.length > 1 ? 's' : ''} sans email)
        `;
        (enrichBtn as HTMLButtonElement).disabled = false;
        (enrichBtn as HTMLButtonElement).style.cursor = 'pointer';
        (enrichBtn as HTMLButtonElement).style.opacity = '1';
      }
    }
  }

  /**
   * Vérifie la limite de recherche côté backend
   * Retourne true si la recherche est autorisée
   */
  private async checkSearchLimit(): Promise<boolean> {
    try {
      const response = await api.post('/search/check');
      this.searchUsage = response.data;
      this.renderSearchCounter();

      if (!response.data.allowed) {
        this.renderSearchLimitReached();
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erreur vérification limite recherche:', error);
      // En cas d'erreur (pas connecté, etc.), on laisse passer
      return true;
    }
  }

  /**
   * Incrémente le compteur de recherche après une recherche réussie
   */
  private async trackSearch(): Promise<void> {
    try {
      const response = await api.post('/search/track');
      this.searchUsage = {
        current: response.data.current,
        max: response.data.max,
        allowed: response.data.max < 0 || response.data.current < response.data.max,
      };
      this.renderSearchCounter();
    } catch (error) {
      console.error('Erreur tracking recherche:', error);
    }
  }

  /**
   * Affiche le compteur de recherches dans le modal
   */
  private renderSearchCounter() {
    if (!this.searchUsage || !this.searchUsage.max || this.searchUsage.max < 0) return;

    const { current, max } = this.searchUsage;
    const existingCounter = document.getElementById('searchUsageCounter');
    if (existingCounter) existingCounter.remove();

    const percentage = (current / max) * 100;
    const isWarning = percentage >= 80;
    const color = isWarning ? '#ef4444' : '#64748b';

    const counter = document.createElement('div');
    counter.id = 'searchUsageCounter';
    counter.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: ${isWarning ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)'}; border-radius: 8px; font-size: 13px; color: ${color}; font-weight: 500; margin-bottom: 12px;`;
    counter.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" width="16" height="16">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>${current}/${max} recherches ce mois</span>
      ${isWarning ? `<span style="margin-left: auto; font-size: 11px; opacity: 0.8;">Limite bientôt atteinte</span>` : ''}
    `;

    // Insérer avant le conteneur de résultats
    const resultsContainer = document.getElementById('businessResults');
    if (resultsContainer?.parentNode) {
      resultsContainer.parentNode.insertBefore(counter, resultsContainer);
    }
  }

  /**
   * Affiche le message de limite atteinte avec CTA upgrade
   */
  private renderSearchLimitReached() {
    const resultsContainer = document.getElementById('businessResults');
    if (!resultsContainer) return;

    const max = this.searchUsage?.max || 15;
    resultsContainer.innerHTML = `
      <div class="panel-empty-state" style="padding: 40px 20px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="32" height="32">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h4 style="margin-bottom: 8px; color: var(--text-primary);">Limite de recherche atteinte</h4>
        <p style="margin-bottom: 20px; color: var(--text-secondary); font-size: 14px;">
          Vous avez utilisé vos <strong>${max} recherches gratuites</strong> ce mois-ci.
          <br/>Passez à Pro pour des recherches illimitées.
        </p>
        <button id="searchUpgradeBtn" style="padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #6366f1); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
          Passer à Pro
        </button>
      </div>
    `;

    document.getElementById('searchUpgradeBtn')?.addEventListener('click', () => {
      window.location.href = '/pricing.html';
    });
  }

  private clearMarkers() {
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];
  }
}
