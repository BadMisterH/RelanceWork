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

  // Types d'entreprises qui ont MOINS souvent de site web (petits commerces, artisans)
  private businessTypesWithoutWebsite = [
    "locksmith",        // Serrurier
    "plumber",          // Plombier
    "electrician",      // Électricien
    "painter",          // Peintre
    "general_contractor", // Entrepreneur général
    "roofing_contractor", // Couvreur
    "moving_company",   // Déménageur
    "car_wash",         // Lavage auto
    "laundry",          // Blanchisserie
    "hair_care",        // Coiffeur
    "beauty_salon",     // Salon de beauté
    "local_business"    // Commerce local
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

  // Effectuer la recherche automatique de plusieurs catégories avec pagination
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
          <p>Détection des entreprises locales sans site web</p>
          <p style="font-size: 0.875rem; margin-top: 8px; color: #94a3b8;">Récupération de plusieurs pages de résultats...</p>
        </div>
      `;
    }

    // Chercher des types spécifiques d'entreprises qui ont moins souvent de site web
    // On fait plusieurs recherches pour augmenter les chances
    console.log(`🎯 Recherche ciblée sur ${this.businessTypesWithoutWebsite.length} types d'entreprises locales`);

    try {
      const allResults: google.maps.places.PlaceResult[] = [];

      // Prendre les 3 premiers types pour ne pas surcharger
      const typesToSearch = this.businessTypesWithoutWebsite.slice(0, 3);

      for (let i = 0; i < typesToSearch.length; i++) {
        const businessType = typesToSearch[i];
        console.log(`🔍 Recherche type ${i + 1}/${typesToSearch.length}: ${businessType}`);

        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="panel-empty-state">
              <div style="width: 80px; height: 80px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <h4 style="margin-top: 20px;">Recherche en cours...</h4>
              <p>Type: ${businessType} (${i + 1}/${typesToSearch.length})</p>
              <p style="font-size: 0.875rem; margin-top: 8px; color: #94a3b8;">${allResults.length} entreprises trouvées</p>
            </div>
          `;
        }

        const request: google.maps.places.PlaceSearchRequest = {
          location: this.userLocation,
          radius: 3000, // 3km de rayon (réduit pour plus de précision)
          type: businessType as any
        };

        const typeResults = await this.searchWithPagination(request);
        console.log(`  ✅ ${typeResults.length} résultats pour ${businessType}`);

        // Ajouter les résultats en évitant les doublons (par place_id)
        const existingIds = new Set(allResults.map(r => r.place_id));
        const newResults = typeResults.filter(r => !existingIds.has(r.place_id));
        allResults.push(...newResults);

        // Pause entre les types pour respecter les limites de l'API
        if (i < typesToSearch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Total: ${allResults.length} entreprises trouvées (recherche ciblée)`);

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

  // Méthode pour gérer la pagination (récupère jusqu'à 60 résultats)
  private async searchWithPagination(
    request: google.maps.places.PlaceSearchRequest,
    accumulatedResults: google.maps.places.PlaceResult[] = [],
    pageNumber: number = 1
  ): Promise<google.maps.places.PlaceResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.service) {
        reject(new Error('Service Places non disponible'));
        return;
      }

      console.log(`📄 Récupération de la page ${pageNumber}...`);

      this.service.nearbySearch(request, async (results, status, pagination) => {
        console.log(`Page ${pageNumber} - Status: ${status}, Résultats: ${results?.length || 0}`);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const newResults = [...accumulatedResults, ...results];
          console.log(`📊 Total accumulé: ${newResults.length} entreprises`);

          // Mettre à jour l'affichage du loading avec le nombre actuel
          const resultsContainer = document.getElementById("businessResults");
          if (resultsContainer && pageNumber < 3) {
            resultsContainer.innerHTML = `
              <div class="panel-empty-state">
                <div style="width: 80px; height: 80px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <h4 style="margin-top: 20px;">Recherche en cours...</h4>
                <p>${newResults.length} entreprises trouvées</p>
                <p style="font-size: 0.875rem; margin-top: 8px; color: #94a3b8;">Page ${pageNumber + 1}/3</p>
              </div>
            `;
          }

          // Vérifier s'il y a une page suivante et si on n'a pas atteint la limite
          if (pagination?.hasNextPage && pageNumber < 3) {
            console.log('➡️ Page suivante disponible, attente de 2 secondes...');

            // Google Places API nécessite un délai de ~2 secondes entre les requêtes paginées
            setTimeout(async () => {
              try {
                pagination.nextPage();
                // On doit refaire l'appel avec le nouveau token
                const nextResults = await this.searchWithPagination(
                  request,
                  newResults,
                  pageNumber + 1
                );
                resolve(nextResults);
              } catch (error) {
                console.error('Erreur lors de la pagination:', error);
                // Retourner les résultats déjà obtenus en cas d'erreur
                resolve(newResults);
              }
            }, 2000);
          } else {
            if (pageNumber >= 3) {
              console.log('✅ Limite de 3 pages atteinte (max ~60 résultats)');
            } else {
              console.log('✅ Pas de page suivante disponible');
            }
            resolve(newResults);
          }
        } else {
          console.error(`Erreur nearbySearch page ${pageNumber}:`, status);
          // Retourner les résultats déjà accumulés en cas d'erreur
          if (accumulatedResults.length > 0) {
            console.log(`⚠️ Erreur mais ${accumulatedResults.length} résultats déjà obtenus`);
            resolve(accumulatedResults);
          } else {
            reject(new Error(`Erreur Places API: ${status}`));
          }
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

    console.log('🔍 Application des filtres:', {
      filterNoWebsite: filterNoWebsite?.checked,
      filterNoEmail: filterNoEmail?.checked,
      filterWithEmail: filterWithEmail?.checked,
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

    console.log(`📊 Résultats après filtres: ${filteredResults.length}`);
    this.displayResults(filteredResults);
  }

  private displayResults(results: BusinessPlace[]) {
    console.log(`🎨 Affichage de ${results.length} résultats`);

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
          ${business.email ? `<span class="info-item" style="color: #10b981;">✅ ${business.email}</span>` : '<span class="info-item">❌ Pas d\'email</span>'}
        </div>
        <div class="business-actions">
          <button class="btn-view-map" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Voir sur la carte
          </button>
          <button class="btn-add-to-favorites" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            Ajouter aux favoris
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

    // Boutons "Ajouter aux favoris"
    const addButtons = document.querySelectorAll(".btn-add-to-favorites");
    addButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const index = parseInt(target.getAttribute("data-index") || "0");
        const business = results[index];
        if (business) {
          this.addToFavorites(business, target);
        }
      });
    });
  }


  /**
   * Ajouter une entreprise aux favoris (stocké dans localStorage)
   */
  private addToFavorites(business: BusinessPlace, button: HTMLButtonElement) {
    try {
      // Récupérer les favoris existants
      const favoritesStr = localStorage.getItem('businessFavorites');
      const favorites: BusinessPlace[] = favoritesStr ? JSON.parse(favoritesStr) : [];

      // Vérifier si déjà dans les favoris
      const alreadyFavorite = favorites.some(f => f.placeId === business.placeId);

      if (alreadyFavorite) {
        // Retirer des favoris
        const newFavorites = favorites.filter(f => f.placeId !== business.placeId);
        localStorage.setItem('businessFavorites', JSON.stringify(newFavorites));

        // Mettre à jour le bouton
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          Ajouter aux favoris
        `;
        button.style.background = '';
        button.style.color = '';

        console.log(`❤️ ${business.name} retiré des favoris`);
      } else {
        // Ajouter aux favoris
        favorites.push(business);
        localStorage.setItem('businessFavorites', JSON.stringify(favorites));

        // Mettre à jour le bouton
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          ❤️ Dans les favoris
        `;
        button.style.background = '#ef4444';
        button.style.color = 'white';

        console.log(`✅ ${business.name} ajouté aux favoris`);

        // Afficher une notification temporaire
        const notification = document.createElement('div');
        notification.textContent = `❤️ ${business.name} ajouté aux favoris`;
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
          font-weight: 600;
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.animation = 'slideOut 0.3s ease-out';
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout aux favoris:", error);
      alert("❌ Erreur lors de l'ajout aux favoris");
    }
  }

  /**
   * Enrichir les résultats avec les emails via Hunter.io
   */
  private async enrichWithEmails(results: BusinessPlace[]) {
    const API_URL = "http://localhost:3000/api";

    // Filtrer les entreprises sans email
    const businessesWithoutEmail = results.filter(b => !b.email);

    if (businessesWithoutEmail.length === 0) {
      alert("Toutes les entreprises ont déjà un email!");
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
      const response = await fetch(`${API_URL}/email-enrichment/find-emails-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companies,
          maxConcurrent: 2 // 2 recherches en parallèle pour Hunter.io
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      console.log("📧 Résultats Hyperbrowser:", data);

      // Mettre à jour les résultats avec les emails trouvés
      let emailsFound = 0;
      data.data.forEach((result: { companyName: string; emails: string[] }) => {
        const business = this.currentResults.find(b => b.name === result.companyName);
        if (business && result.emails.length > 0) {
          business.email = result.emails[0]; // Prendre le premier email
          emailsFound++;
        }
      });

      console.log(`✅ ${emailsFound} email(s) trouvé(s) sur ${businessesWithoutEmail.length} entreprises`);

      // Rafraîchir l'affichage
      this.applyFilters();

      // Afficher un message de succès
      alert(`✅ Enrichissement terminé!\n\n${emailsFound} email(s) trouvé(s) sur ${businessesWithoutEmail.length} entreprises.\n\nLes résultats ont été mis à jour.`);
    } catch (error) {
      console.error("❌ Erreur lors de l'enrichissement:", error);
      alert(`❌ Erreur lors de l'enrichissement des emails.\n\nVérifiez que:\n1. Le backend est lancé (npm run dev)\n2. La clé API Hunter.io est configurée dans .env\n3. Votre connexion internet fonctionne\n4. Vous n'avez pas dépassé votre quota Hunter.io\n\nDétails: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);

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

  private clearMarkers() {
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];
  }
}
