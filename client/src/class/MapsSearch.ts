/// <reference types="google.maps" />

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
}

export class MapsSearch {
  private map: google.maps.Map | null = null;
  private service: google.maps.places.PlacesService | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private currentResults: BusinessPlace[] = [];
  private googleMapsLoaded: boolean = false;
  private userLocation: { lat: number; lng: number } | null = null;

  // Catégories d'entreprises à chercher automatiquement
  private businessCategories = [
    "agences web",
    "développeurs freelance",
    "graphistes",
    "photographes",
    "artisans",
    "plombiers",
    "électriciens",
    "menuisiers",
    "coiffeurs",
    "restaurants",
    "cafés",
    "boutiques"
  ];

  constructor() {
    // Attacher les événements immédiatement (pas besoin de Google Maps pour ça)
    this.initEvents();
  }

  // Méthode appelée quand Google Maps API est chargée
  public onGoogleMapsLoaded() {
    this.googleMapsLoaded = true;
    this.initMap();
    console.log('Google Maps initialisé et prêt');
    // La recherche automatique sera lancée quand le modal s'ouvre
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

  // Effectuer la recherche automatique de plusieurs catégories
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
        <div class="loading-text">
          <p style="margin-bottom: 12px;">🔍 Recherche automatique en cours...</p>
          <p style="font-size: 0.8rem;">Détection des entreprises locales sans site web...</p>
        </div>
      `;
    }

    // Chercher les entreprises locales (toutes catégories confondues)
    const request: google.maps.places.PlaceSearchRequest = {
      location: this.userLocation,
      radius: 5000, // 5km de rayon
      type: "establishment" // Tous types d'établissements
    };

    console.log('Lancement nearbySearch avec:', request);

    this.service.nearbySearch(request, (results, status) => {
      console.log('nearbySearch réponse:', { status, resultCount: results?.length });

      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        console.log(`✅ ${results.length} entreprises trouvées dans un rayon de 5km`);
        this.handleSearchResults(results);
      } else {
        console.error('Erreur nearbySearch:', status);
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="error-text">
              <p>❌ Aucune entreprise trouvée dans votre zone</p>
              <p style="font-size: 0.8rem; margin-top: 8px;">Status: ${status}</p>
              <p style="font-size: 0.8rem;">Essayez une recherche manuelle</p>
            </div>
          `;
        }
      }
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

        // Déclencher la recherche automatique quand le modal s'ouvre
        if (this.googleMapsLoaded && !this.userLocation) {
          console.log('Lancement de la recherche automatique...');
          this.startAutoSearch();
        } else if (this.userLocation && this.currentResults.length === 0) {
          console.log('Position déjà connue, relancement de la recherche...');
          this.performAutoSearch();
        }
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      });
    }

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

    if (filterNoWebsite) {
      filterNoWebsite.addEventListener("change", () => {
        this.applyFilters();
      });
    }

    if (filterNoEmail) {
      filterNoEmail.addEventListener("change", () => {
        this.applyFilters();
      });
    }
  }

  private async searchPlaces(query: string) {
    console.log('🔍 Recherche manuelle:', query);

    const resultsContainer = document.getElementById("businessResults");

    // Vérifier si Google Maps est chargé
    if (!this.googleMapsLoaded || !this.service || !this.map) {
      console.error('Google Maps non chargé ou service indisponible');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="error-text">
            <p style="margin-bottom: 12px;">⚠️ Google Maps n'est pas configuré</p>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">
              Vous devez configurer une clé API Google Maps.<br/>
              Consultez le fichier <strong>GOOGLE_MAPS_SETUP.md</strong> pour les instructions.
            </p>
          </div>
        `;
      }
      return;
    }

    // Afficher un loader
    if (resultsContainer) {
      resultsContainer.innerHTML = '<p class="loading-text">Recherche en cours...</p>';
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
        this.handleSearchResults(results);
      } else {
        console.error('Erreur textSearch:', status);
        if (resultsContainer) {
          resultsContainer.innerHTML = `<p class="error-text">Aucun résultat trouvé (Status: ${status})</p>`;
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

    console.log('🔍 Application des filtres:', {
      filterNoWebsite: filterNoWebsite?.checked,
      filterNoEmail: filterNoEmail?.checked,
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

    console.log(`📊 Résultats après filtres: ${filteredResults.length}`);
    this.displayResults(filteredResults);
  }

  private displayResults(results: BusinessPlace[]) {
    console.log(`🎨 Affichage de ${results.length} résultats`);

    const resultsContainer = document.getElementById("businessResults");
    const resultsCount = document.getElementById("resultsCount");

    if (resultsCount) {
      resultsCount.textContent = `(${results.length})`;
    }

    if (!resultsContainer) {
      console.error('❌ Container "businessResults" non trouvé');
      return;
    }

    if (results.length === 0) {
      console.log('Aucun résultat à afficher');
      resultsContainer.innerHTML = '<p class="empty-text">Aucune entreprise ne correspond aux filtres</p>';
      this.clearMarkers();
      return;
    }

    console.log('Génération du HTML pour les résultats...');

    // Nettoyer les marqueurs et en créer de nouveaux
    this.clearMarkers();

    resultsContainer.innerHTML = results
      .map(
        (business, index) => `
      <div class="business-card" data-index="${index}">
        <div class="business-header">
          <h4>${business.name}</h4>
          ${business.rating ? `<span class="business-rating">⭐ ${business.rating}</span>` : ""}
        </div>
        <p class="business-address">${business.address}</p>
        <div class="business-info">
          ${business.phone ? `<span class="info-item">📞 ${business.phone}</span>` : ""}
          ${!business.website ? '<span class="info-item badge-no-website">❌ Pas de site web</span>' : '<span class="info-item">✅ Site web existant</span>'}
          ${!business.email ? '<span class="info-item">❌ Pas d\'email</span>' : ""}
        </div>
        <div class="business-actions">
          <button class="btn-view-map" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Voir sur la carte
          </button>
          <button class="btn-add-to-candidates" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter comme candidature
          </button>
        </div>
      </div>
    `
      )
      .join("");

    // Créer les marqueurs
    results.forEach((business, index) => {
      this.createMarker(business, index);
    });

    // Attacher les événements
    this.attachResultEvents(results);
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
    // Boutons "Voir sur la carte"
    const viewMapButtons = document.querySelectorAll(".btn-view-map");
    viewMapButtons.forEach((btn) => {
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
        }
      });
    });

    // Boutons "Ajouter comme candidature"
    const addButtons = document.querySelectorAll(".btn-add-to-candidates");
    addButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const index = parseInt(target.getAttribute("data-index") || "0");
        const business = results[index];
        if (business) {
          await this.addToApplications(business);
        }
      });
    });
  }

  private async addToApplications(business: BusinessPlace) {
    try {
      const API_URL = "http://localhost:3000/api";

      // Extraire un email s'il existe (Google Places API ne fournit pas toujours d'email)
      const data = {
        company: business.name,
        poste: "Développeur", // Poste par défaut, l'utilisateur pourra le modifier
        email: business.email || undefined,
        phone: business.phone || undefined,
        status: "En attente",
        isRelance: false,
      };

      const response = await fetch(`${API_URL}/application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'ajout");
      }

      alert(`✅ ${business.name} a été ajouté à vos candidatures !`);

      // Optionnel: rafraîchir la liste des candidatures
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error);
      alert("❌ Erreur lors de l'ajout de la candidature");
    }
  }

  private clearMarkers() {
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];
  }
}
