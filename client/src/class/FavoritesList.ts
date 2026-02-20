/**
 * Favorites List - Liste des entreprises favorites
 */

import type { BusinessPlace } from './MapsSearch';
import api from '../lib/api';

export class FavoritesList {
  private container: HTMLElement | null;
  private favorites: BusinessPlace[] = [];

  constructor(containerId: string = 'favoritesList') {
    this.container = document.getElementById(containerId);
  }

  /**
   * Charger et afficher les favoris
   */
  public async render() {
    if (!this.container) return;


    try {
      // Charger les favoris depuis le backend
      await this.loadFavoritesFromBackend();

      if (this.favorites.length === 0) {
        this.container.innerHTML = this.renderEmptyState();
        this.attachEventListeners();
        return;
      }

      this.container.innerHTML = `
        <div class="favorites-page">
          <div class="favorites-header">
            <div class="favorites-header-left">
              <h2 class="favorites-title">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="32" height="32">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                Mes Favoris
              </h2>
              <span class="favorites-count">${this.favorites.length} entreprise${this.favorites.length > 1 ? 's' : ''}</span>
            </div>
            <button class="favorites-clear-btn" id="clearAllFavorites">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Tout supprimer
            </button>
          </div>

          <div class="favorites-grid">
            ${this.favorites.map((business, index) => this.renderFavoriteCard(business, index)).join('')}
          </div>
        </div>
      `;

      this.attachEventListeners();
    } catch (error) {
      console.error('❌ Erreur lors du chargement des favoris:', error);
      this.container.innerHTML = this.renderErrorState();
      this.attachEventListeners();
    }
  }

  /**
   * Charger les favoris depuis le backend
   */
  private async loadFavoritesFromBackend() {
    try {
      const response = await api.get('/favorites');

      // Transformer les données du backend en BusinessPlace[]
      this.favorites = response.data.map((fav: any) => fav.businessData);
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des favoris:', error);
      if (error.response?.status === 401) {
        console.warn('Non authentifié - redirection vers login');
      }
      this.favorites = [];
      throw error;
    }
  }

  /**
   * Retirer un favori
   */
  private async removeFavorite(placeId: string) {
    try {
      await api.delete(`/favorites/${placeId}`);

      // Émettre un événement pour notifier que les favoris ont été mis à jour
      window.dispatchEvent(new CustomEvent('favorites-updated'));

      // Rafraîchir l'affichage
      await this.render();
    } catch (error) {
      console.error('❌ Erreur lors de la suppression du favori:', error);
      (window as any).showToast?.('error', 'Erreur lors de la suppression du favori');
    }
  }

  /**
   * Retirer tous les favoris
   */
  private async clearAllFavorites() {
    if (confirm(`Êtes-vous sûr de vouloir supprimer tous vos favoris (${this.favorites.length} entreprises) ?`)) {
      try {
        // Supprimer chaque favori
        const deletePromises = this.favorites.map(fav =>
          api.delete(`/favorites/${fav.placeId}`)
        );

        await Promise.all(deletePromises);

        // Émettre un événement pour notifier que les favoris ont été mis à jour
        window.dispatchEvent(new CustomEvent('favorites-updated'));

        await this.render();
      } catch (error) {
        console.error('❌ Erreur lors de la suppression des favoris:', error);
        (window as any).showToast?.('error', 'Erreur lors de la suppression des favoris');
      }
    }
  }

  /**
   * Afficher une carte de favori
   */
  private renderFavoriteCard(business: BusinessPlace, index: number): string {
    let domain = '';
    if (business.website) {
      try {
        domain = new URL(business.website).hostname.replace('www.', '');
      } catch {
        /* ignore */
      }
    }

    const hasEmail = !!business.email;
    const hasHunterEmail = business.emailFoundViaHunter === true;

    return `
      <div class="favorite-card" data-place-id="${business.placeId}" data-index="${index}">
        ${hasHunterEmail ? '<div class="favorite-hunter-badge">🎯 Hunter.io</div>' : ''}

        <div class="favorite-card-header">
          <div class="favorite-avatar">${business.name.charAt(0).toUpperCase()}</div>
          <div class="favorite-info">
            <h3 class="favorite-name">${this.escapeHtml(business.name)}</h3>
            <p class="favorite-address">${this.escapeHtml(business.address)}</p>
          </div>
          ${business.rating ? `<span class="favorite-rating">⭐ ${business.rating}</span>` : ''}
        </div>

        <div class="favorite-card-body">
          <div class="favorite-tags">
            ${business.website
              ? `<a href="${business.website}" target="_blank" rel="noopener" class="favorite-tag favorite-tag--website">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  ${domain}
                </a>`
              : `<span class="favorite-tag favorite-tag--no-website">Pas de site web</span>`}

            ${business.phone
              ? `<span class="favorite-tag favorite-tag--phone">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  ${business.phone}
                </span>`
              : ''}

            ${hasEmail && business.email
              ? `<span class="favorite-tag favorite-tag--email ${hasHunterEmail ? 'hunter-email' : ''}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  ${this.escapeHtml(business.email)}
                </span>`
              : `<span class="favorite-tag favorite-tag--no-email">Pas d'email</span>`}
          </div>
        </div>

        <div class="favorite-card-actions">
          <button class="favorite-action-btn favorite-action-btn--remove" data-place-id="${business.placeId}" title="Retirer des favoris">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="18" height="18">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            Retirer
          </button>
          ${business.website
            ? `<a href="${business.website}" target="_blank" rel="noopener" class="favorite-action-btn favorite-action-btn--visit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Visiter
              </a>`
            : ''}
        </div>
      </div>
    `;
  }

  /**
   * État vide
   */
  private renderEmptyState(): string {
    return `
      <div class="favorites-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="80" height="80">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <h3>Aucun favori pour le moment</h3>
        <p>Ajoutez des entreprises à vos favoris lors de vos recherches pour les retrouver facilement ici.</p>
        <button class="favorites-cta" id="openSearchFromFavorites">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Rechercher des entreprises
        </button>
      </div>
    `;
  }

  /**
   * État d'erreur
   */
  private renderErrorState(): string {
    return `
      <div class="favorites-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="80" height="80">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3>Erreur de chargement</h3>
        <p>Impossible de charger vos favoris. Vérifiez votre connexion.</p>
        <button class="favorites-cta" id="retryLoadFavorites">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Réessayer
        </button>
      </div>
    `;
  }

  /**
   * Attacher les événements
   */
  private attachEventListeners() {
    // Bouton "Tout supprimer"
    const clearAllBtn = document.getElementById('clearAllFavorites');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAllFavorites());
    }

    // Boutons "Retirer"
    document.querySelectorAll('.favorite-action-btn--remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const placeId = target.getAttribute('data-place-id');
        if (placeId) {
          this.removeFavorite(placeId);
        }
      });
    });

    // Bouton CTA "Rechercher des entreprises"
    const ctaBtn = document.getElementById('openSearchFromFavorites');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        const searchModal = document.getElementById('searchModal');
        searchModal?.classList.add('active');
      });
    }

    // Bouton "Réessayer" (état d'erreur)
    const retryBtn = document.getElementById('retryLoadFavorites');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.render());
    }
  }

  /**
   * Échapper le HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
