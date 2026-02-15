/**
 * Executive Dashboard - Notion-Inspired Clean Interface
 * Aesthetic: Modern, minimal, professional
 */

import type { Application } from '../main';

export class ExecutiveDashboard {
  private container: HTMLElement | null;
  private applications: Application[] = [];
  private filteredApplications: Application[] = [];
  private searchTerm: string = '';
  private activeFilter: string = 'all';

  constructor(containerId: string = 'applicationsList') {
    this.container = document.getElementById(containerId);
  }

  /**
   * Affiche le dashboard
   */
  public render(applications: Application[]) {
    if (!this.container) return;

    // Trier par date décroissante (plus récent en premier)
    this.applications = [...applications].sort((a, b) => {
      return this.parseDate(b.date).getTime() - this.parseDate(a.date).getTime();
    });

    // Appliquer les filtres actifs (statut + recherche)
    let result = this.applications;

    if (this.activeFilter !== 'all') {
      result = result.filter(app => this.getStatusClass(app.status) === this.activeFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(app =>
        app.company.toLowerCase().includes(term) ||
        app.poste.toLowerCase().includes(term) ||
        app.status.toLowerCase().includes(term)
      );
    }

    this.filteredApplications = result;

    const html = `
      ${this.renderStats()}
      ${this.renderTrackingTable()}
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
    this.updateStatsNumbers();

    // Restaurer la valeur de recherche dans l'input et le focus
    if (this.searchTerm) {
      const searchInput = document.getElementById('dashTableSearch') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = this.searchTerm;
        // Restaurer le focus et le curseur à la fin
        searchInput.focus();
        searchInput.setSelectionRange(this.searchTerm.length, this.searchTerm.length);
      }
    }
  }

  /**
   * Cartes de statistiques
   */
  private renderStats(): string {
    const stats = this.calculateStats();

    return `
      <div class="dash-stats-grid">
        <div class="dash-stat-card dash-stat-total" data-stat="total">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">📊</span>
            <span class="dash-stat-label">Total</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.total}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">Candidatures</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-pending" data-stat="pending">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">⏳</span>
            <span class="dash-stat-label">En attente</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.pending}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.pendingPercent}% du total</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-interview" data-stat="interview">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">💼</span>
            <span class="dash-stat-label">Entretiens</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.interviews}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.interviewRate}% de conversion</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-accepted" data-stat="accepted">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">✅</span>
            <span class="dash-stat-label">Acceptées</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.accepted}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.successRate}% de réussite</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-relance" data-stat="relance">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">🔔</span>
            <span class="dash-stat-label">À relancer</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.toRelance}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.relancePercent}% nécessitent action</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Boutons de filtre par statut
   */
  private renderFilterButtons(): string {
    const filters = [
      { key: 'all', label: 'Tout', icon: '📋' },
      { key: 'sent', label: 'Envoyée', icon: '📤' },
      { key: 'waiting', label: 'En attente', icon: '⏳' },
      { key: 'interview', label: 'Entretien', icon: '💼' },
      { key: 'accepted', label: 'Acceptée', icon: '✅' },
      { key: 'rejected', label: 'Refusée', icon: '❌' },
      { key: 'no-response', label: 'Pas de réponse', icon: '🔇' },
    ];

    return filters.map(f => {
      const count = f.key === 'all'
        ? this.applications.length
        : this.applications.filter(a => this.getStatusClass(a.status) === f.key).length;

      return `<button class="dash-filter-btn ${this.activeFilter === f.key ? 'active' : ''} dash-filter-${f.key}"
        data-filter="${f.key}">
        <span class="dash-filter-icon">${f.icon}</span>
        <span class="dash-filter-label">${f.label}</span>
        <span class="dash-filter-count">${count}</span>
      </button>`;
    }).join('');
  }

  /**
   * Tableau de suivi
   */
  private renderTrackingTable(): string {
    const apps = this.filteredApplications;

    return `
      <div class="dash-table-section">
        <div class="dash-table-header">
          <div class="dash-table-title-wrapper">
            <h2 class="dash-table-title">Mes Candidatures</h2>
            <span class="dash-table-count">${apps.length}</span>
          </div>
          <div class="dash-table-controls">
            <div class="dash-filter-group">
              ${this.renderFilterButtons()}
            </div>
            <div class="dash-search-wrapper">
              <svg class="dash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Rechercher une entreprise ou un poste..."
                id="dashTableSearch"
                class="dash-search-input"
              />
            </div>
          </div>
        </div>

        <div class="dash-table-wrapper">
          ${apps.length === 0 ? this.renderEmptyState() : this.renderTable(apps)}
        </div>
      </div>
    `;
  }

  /**
   * Tableau HTML
   */
  private renderTable(apps: Application[]): string {
    return `
      <table class="dash-table">
        <thead>
          <tr>
            <th class="dash-th dash-th-company">Entreprise</th>
            <th class="dash-th dash-th-poste">Poste</th>
            <th class="dash-th dash-th-status">Statut</th>
            <th class="dash-th dash-th-date">Date</th>
            <th class="dash-th dash-th-relance">Relances</th>
            <th class="dash-th dash-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map((app, index) => this.renderTableRow(app, index)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Ligne de tableau
   */
  private renderTableRow(app: Application, index: number): string {
    const statusClass = this.getStatusClass(app.status);
    const statusEmoji = this.getStatusEmoji(app.status);
    const relanceText = app.relanced ? `${app.relance_count || 1}×` : '—';
    const relanceClass = app.relanced ? 'dash-has-relance' : '';

    return `
      <tr class="dash-table-row" data-app-id="${app.id}" style="animation-delay: ${index * 0.03}s">
        <td class="dash-td dash-td-company">
          <div class="dash-company-wrapper">
            <div class="dash-company-avatar">${app.company.charAt(0).toUpperCase()}</div>
            <div class="dash-company-info">
              <div class="dash-company-name-row">
                <span class="dash-company-name">${this.escapeHtml(app.company)}</span>
                ${app.company_website ? `<a href="${this.escapeHtml(app.company_website)}" target="_blank" rel="noopener" class="dash-company-link" title="Voir le site web">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>` : ''}
              </div>
              ${app.company_description ? `<span class="dash-company-desc">${this.escapeHtml(app.company_description).substring(0, 80)}${app.company_description.length > 80 ? '...' : ''}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="dash-td dash-td-poste">
          <span class="dash-poste-text">${this.escapeHtml(app.poste)}</span>
        </td>
        <td class="dash-td dash-td-status">
          <div class="dash-status-dropdown" data-app-id="${app.id}">
            <button class="dash-status-badge dash-status-${statusClass} dash-status-trigger" type="button">
              <span class="dash-status-icon">${statusEmoji}</span>
              <span class="dash-status-text">${this.escapeHtml(app.status)}</span>
              <svg class="dash-status-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="dash-status-menu">
              ${this.renderStatusOptions(app.status)}
            </div>
          </div>
        </td>
        <td class="dash-td dash-td-date">
          <span class="dash-date-text">${this.formatDate(app.date)}</span>
        </td>
        <td class="dash-td dash-td-relance">
          <span class="dash-relance-badge ${relanceClass}">
            ${app.relanced ? '🔔' : '—'} ${relanceText}
          </span>
        </td>
        <td class="dash-td dash-td-actions">
          <div class="dash-actions-group">
            <button
              class="dash-action-btn dash-btn-relance"
              data-action="relance"
              data-id="${app.id}"
              title="Relancer cette candidature"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Relancer
            </button>
            ${app.company_website && !app.company_description ? `<button
              class="dash-action-btn dash-btn-enrich"
              data-action="enrich"
              data-id="${app.id}"
              data-website="${this.escapeHtml(app.company_website)}"
              title="Enrichir les infos entreprise"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>` : ''}
            <button
              class="dash-action-btn dash-btn-delete"
              data-action="delete"
              data-id="${app.id}"
              title="Supprimer cette candidature"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * État vide
   */
  private renderEmptyState(): string {
    return `
      <div class="dash-empty-state">
        <div class="dash-empty-icon">📭</div>
        <div class="dash-empty-title">Aucune candidature trouvée</div>
        <div class="dash-empty-text">
          ${this.searchTerm
            ? `Aucun résultat pour "${this.escapeHtml(this.searchTerm)}"`
            : 'Commencez par ajouter votre première candidature'
          }
        </div>
      </div>
    `;
  }

  /**
   * Calcul des statistiques
   */
  private calculateStats() {
    const total = this.applications.length;
    const pending = this.applications.filter(a =>
      a.status.toLowerCase().includes('attente') ||
      a.status.toLowerCase().includes('envoyée') ||
      a.status.toLowerCase().includes('postul')
    ).length;
    const interviews = this.applications.filter(a =>
      a.status.toLowerCase().includes('entretien')
    ).length;
    const accepted = this.applications.filter(a =>
      a.status.toLowerCase().includes('accepté') ||
      a.status.toLowerCase().includes('proposé')
    ).length;
    const toRelance = this.applications.filter(a => !a.relanced &&
      !a.status.toLowerCase().includes('accepté') &&
      !a.status.toLowerCase().includes('refusé') &&
      !a.status.toLowerCase().includes('retiré')
    ).length;

    return {
      total,
      pending,
      interviews,
      accepted,
      toRelance,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
      interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 0,
      successRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      relancePercent: total > 0 ? Math.round((toRelance / total) * 100) : 0
    };
  }

  /**
   * Classe CSS selon le statut
   */
  private getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return 'sent';
    if (s.includes('entretien')) return 'interview';
    if (s.includes('accepté') || s.includes('proposé')) return 'accepted';
    if (s.includes('refusé')) return 'rejected';
    if (s.includes('attente')) return 'waiting';
    if (s.includes('pas de réponse') || s.includes('retiré')) return 'no-response';
    return 'sent';
  }

  /**
   * Emoji selon le statut
   */
  private getStatusEmoji(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return '📤';
    if (s.includes('entretien')) return '💼';
    if (s.includes('accepté') || s.includes('proposé')) return '✅';
    if (s.includes('refusé')) return '❌';
    if (s.includes('attente')) return '⏳';
    if (s.includes('pas de réponse')) return '🔇';
    if (s.includes('retiré')) return '🔙';
    return '📧';
  }

  /**
   * Options du dropdown de statut
   */
  private renderStatusOptions(currentStatus: string): string {
    const statuses = [
      { label: 'En attente', emoji: '⏳', class: 'waiting' },
      { label: 'Entretien', emoji: '💼', class: 'interview' },
      { label: 'Accepté', emoji: '✅', class: 'accepted' },
      { label: 'Refusé', emoji: '❌', class: 'rejected' },
      { label: 'Pas de réponse', emoji: '🔇', class: 'no-response' },
    ];

    return statuses.map(s => {
      const isActive = currentStatus.toLowerCase().includes(s.label.toLowerCase().split(' ')[0]);
      return `
        <button
          class="dash-status-option dash-status-${s.class} ${isActive ? 'active' : ''}"
          data-status="${s.label}"
          type="button"
        >
          <span class="dash-status-icon">${s.emoji}</span>
          <span class="dash-status-text">${s.label}</span>
          ${isActive ? '<svg class="dash-status-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </button>
      `;
    }).join('');
  }

  /**
   * Formatage de date relatif
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '—';

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Animation des chiffres
   */
  private animateNumber(element: HTMLElement, target: number) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * easeOut);

      element.textContent = current.toString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = target.toString();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Mettre à jour les chiffres des stats avec animation
   */
  private updateStatsNumbers() {
    const statValues = document.querySelectorAll('.dash-stat-value');
    statValues.forEach(element => {
      const target = parseInt((element as HTMLElement).dataset.count || '0');
      this.animateNumber(element as HTMLElement, target);
    });
  }

  /**
   * Échapper le HTML pour éviter les injections XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Gestion des événements
   */
  private attachEventListeners() {
    // Filtres par statut
    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = (btn as HTMLElement).dataset.filter || 'all';
        this.activeFilter = filter;
        this.filterApplications();
      });
    });

    // Recherche
    const searchInput = document.getElementById('dashTableSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.filterApplications();
      });
    }

    // Actions (Relancer / Supprimer)
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'relance') {
          this.handleRelance(Number(id));
        } else if (action === 'delete') {
          this.handleDelete(Number(id));
        } else if (action === 'enrich') {
          const website = target.dataset.website;
          this.handleEnrich(Number(id), website || '');
        }
      });
    });

    // Dropdowns de statut
    this.attachStatusDropdownListeners();
  }

  /**
   * Gérer les dropdowns de statut
   */
  private attachStatusDropdownListeners() {
    // Ouvrir/fermer les dropdowns
    document.querySelectorAll('.dash-status-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = (trigger as HTMLElement).closest('.dash-status-dropdown');
        const isOpen = dropdown?.classList.contains('active');

        // Fermer tous les autres dropdowns
        document.querySelectorAll('.dash-status-dropdown').forEach(d => d.classList.remove('active'));

        // Toggle ce dropdown
        if (!isOpen) {
          dropdown?.classList.add('active');
        }
      });
    });

    // Sélection d'un statut
    document.querySelectorAll('.dash-status-option').forEach(option => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const newStatus = target.dataset.status;
        const dropdown = target.closest('.dash-status-dropdown');
        const appId = dropdown?.getAttribute('data-app-id');

        if (newStatus && appId) {
          await this.handleStatusChange(Number(appId), newStatus);
        }

        // Fermer le dropdown
        dropdown?.classList.remove('active');
      });
    });

    // Fermer les dropdowns au clic extérieur
    document.addEventListener('click', () => {
      document.querySelectorAll('.dash-status-dropdown').forEach(d => d.classList.remove('active'));
    });
  }

  /**
   * Gérer le changement de statut
   */
  private async handleStatusChange(id: number, newStatus: string) {
    const event = new CustomEvent('status-change', { detail: { id, status: newStatus } });
    window.dispatchEvent(event);
  }

  /**
   * Filtrer les candidatures
   */
  /**
   * Parse une date au format JJ/MM/AAAA ou ISO
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date(0);

    // Format JJ/MM/AAAA
    const parts = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (parts) {
      return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    }

    // Format ISO ou autre
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  private filterApplications() {
    // Appliquer le filtre de statut
    let result = this.applications;

    if (this.activeFilter !== 'all') {
      result = result.filter(app => this.getStatusClass(app.status) === this.activeFilter);
    }

    // Appliquer le filtre de recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(app =>
        app.company.toLowerCase().includes(term) ||
        app.poste.toLowerCase().includes(term) ||
        app.status.toLowerCase().includes(term)
      );
    }

    this.filteredApplications = result;

    // Mettre à jour uniquement le tableau et le compteur
    const tableWrapper = document.querySelector('.dash-table-wrapper');
    const countBadge = document.querySelector('.dash-table-count');

    if (tableWrapper) {
      const apps = this.filteredApplications;
      tableWrapper.innerHTML = apps.length === 0 ? this.renderEmptyState() : this.renderTable(apps);

      // Ré-attacher les événements d'action sur les nouvelles lignes
      document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement;
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'relance') {
            this.handleRelance(Number(id));
          } else if (action === 'delete') {
            this.handleDelete(Number(id));
          } else if (action === 'enrich') {
            const website = target.dataset.website;
            this.handleEnrich(Number(id), website || '');
          }
        });
      });

      // Ré-attacher les événements de dropdown de statut
      this.attachStatusDropdownListeners();
    }

    if (countBadge) {
      countBadge.textContent = `${this.filteredApplications.length}`;
    }

    // Mettre à jour l'état actif des boutons de filtre
    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
      const key = (btn as HTMLElement).dataset.filter;
      btn.classList.toggle('active', key === this.activeFilter);
    });
  }

  /**
   * Gérer la relance
   */
  private handleRelance(id: number) {
    const event = new CustomEvent('relance-application', { detail: { id } });
    window.dispatchEvent(event);
  }

  /**
   * Gérer l'enrichissement entreprise
   */
  private handleEnrich(id: number, website: string) {
    const event = new CustomEvent('enrich-company', { detail: { id, website } });
    window.dispatchEvent(event);
  }

  /**
   * Gérer la suppression
   */
  private handleDelete(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette candidature ?')) {
      const event = new CustomEvent('delete-application', { detail: { id } });
      window.dispatchEvent(event);
    }
  }
}
