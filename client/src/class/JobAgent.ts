import api from '../lib/api';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PROFILE_KEY = 'relancework-agent-profile';

interface Prospect {
  id: string;
  title: string;
  company: string;
  location: string;
  match_score: number;
  job_type: string;
  seniority: string;
  skills_required: string[];
  skills_missing: string[];
  why_apply: string;
  cover_letter: string | null;
  status: string;
  source_url: string;
  created_at: string;
}

export class JobAgent {
  private container: HTMLElement | null;
  private prospects: Prospect[] = [];
  private isSearching = false;
  private currentProspectId: string | null = null;
  private isEditing = false;
  private filterScore = 0;

  constructor(containerId: string = 'jobAgentView') {
    this.container = document.getElementById(containerId);
  }

  public render() {
    if (!this.container) return;
    this.container.innerHTML = this.buildHTML();
    this.bindEvents();
    this.loadProspects();
  }

  private buildHTML(): string {
    const savedProfile = localStorage.getItem(PROFILE_KEY) || '';
    const savedLinkedin = localStorage.getItem(PROFILE_KEY + '-linkedin') || '';
    return `
      <div class="ja-layout">
        <!-- Left: Search Form -->
        <div class="ja-panel">
          <div class="ja-panel-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3>Nouvelle recherche</h3>
          </div>

          <div class="ja-form">
            <div class="ja-field">
              <label>Poste recherché</label>
              <input id="ja-keyword" type="text" placeholder="Ex: Développeur React, DevOps..." />
            </div>
            <div class="ja-field">
              <label>Localisation</label>
              <input id="ja-location" type="text" value="Paris" />
            </div>
            <div class="ja-field">
              <label>Source des offres</label>
              <select id="ja-source">
                <option value="indeed">Indeed (Puppeteer — gratuit)</option>
                <option value="jsearch">LinkedIn + Indeed + Glassdoor (JSearch API)</option>
              </select>
            </div>

            <div class="ja-field-row">
              <div class="ja-field">
                <label>Pages</label>
                <select id="ja-pages">
                  <option value="1">1 page (~10 offres)</option>
                  <option value="2" selected>2 pages (~20 offres)</option>
                  <option value="3">3 pages (~30 offres)</option>
                </select>
              </div>
              <div class="ja-field">
                <label>Score minimum</label>
                <select id="ja-score">
                  <option value="50">50+</option>
                  <option value="60">60+</option>
                  <option value="70" selected>70+</option>
                  <option value="80">80+</option>
                </select>
              </div>
            </div>

            <!-- CV Upload -->
            <div class="ja-field">
              <label>CV <span class="ja-label-hint">(PDF)</span></label>
              <div class="ja-cv-drop" id="ja-cv-drop">
                <input type="file" id="ja-cv-input" accept=".pdf" style="display:none" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span id="ja-cv-label">${savedProfile ? 'CV importé — cliquer pour changer' : 'Déposer votre CV (PDF) ou <u>cliquer ici</u>'}</span>
                <span class="ja-cv-hint" id="ja-cv-status" style="color:${savedProfile ? '#10b981' : ''}">${savedProfile ? savedProfile.length + ' caractères en mémoire' : ''}</span>
              </div>
            </div>

            <!-- LinkedIn -->
            <div class="ja-field">
              <label>
                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="vertical-align:middle;margin-right:4px">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
                </svg>
                Profil LinkedIn <span class="ja-label-hint">(optionnel)</span>
              </label>
              <input id="ja-linkedin" type="url" placeholder="https://linkedin.com/in/votre-profil" value="${savedLinkedin}" />
            </div>

            <!-- Hidden profile textarea (populated from PDF) -->
            <textarea id="ja-profile" style="display:none">${savedProfile}</textarea>

            <label class="ja-checkbox-label">
              <input type="checkbox" id="ja-letters" />
              Générer les lettres de motivation automatiquement
            </label>
            <button class="ja-search-btn" id="ja-search-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Lancer la recherche
            </button>
          </div>

          <div class="ja-loading" id="ja-loading" style="display:none">
            <div class="ja-spinner"></div>
            <p id="ja-loading-msg">Scraping Indeed en cours...</p>
          </div>
        </div>

        <!-- Right: Results -->
        <div class="ja-results-panel">
          <div class="ja-results-header">
            <div class="ja-results-title">
              <h3>Offres analysées</h3>
              <span class="ja-count" id="ja-count">0 offre(s)</span>
            </div>
            <div class="ja-filter-row">
              <label class="ja-filter-label">Afficher score ≥</label>
              <select id="ja-filter-score" class="ja-filter-select">
                <option value="0">Tout</option>
                <option value="50">50+</option>
                <option value="60">60+</option>
                <option value="70">70+</option>
                <option value="80">80+</option>
              </select>
            </div>
          </div>
          <div class="ja-score-legend">
            <span class="legend-dot legend-high"></span><span>≥80 Excellent</span>
            <span class="legend-dot legend-mid"></span><span>60–79 Bon</span>
            <span class="legend-dot legend-low"></span><span>&lt;60 Partiel</span>
          </div>
          <div id="ja-results-list" class="ja-results-list">
            <div class="ja-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <p>Lance une recherche pour voir les offres analysées par l'IA</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Letter Modal -->
      <div class="ja-modal-overlay" id="ja-modal" style="display:none">
        <div class="ja-modal">
          <div class="ja-modal-header">
            <h4>Lettre de motivation</h4>
            <div class="ja-modal-header-actions">
              <button class="ja-btn-edit" id="ja-edit-letter" title="Modifier la lettre">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Modifier
              </button>
              <button class="ja-modal-close" id="ja-modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="ja-modal-body" id="ja-modal-body"></div>
          <textarea class="ja-modal-editor" id="ja-modal-editor" style="display:none" rows="14"></textarea>
          <div class="ja-modal-actions">
            <button class="ja-btn-secondary" id="ja-copy-letter">Copier</button>
            <button class="ja-btn-save" id="ja-save-letter" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    document.getElementById('ja-search-btn')?.addEventListener('click', () => this.startSearch());
    const syncFilter = (e: Event) => {
      const val = parseInt((e.target as HTMLSelectElement).value || '0');
      this.filterScore = val;
      // keep both dropdowns in sync
      const formSelect = document.getElementById('ja-score') as HTMLSelectElement;
      const panelSelect = document.getElementById('ja-filter-score') as HTMLSelectElement;
      if (formSelect) formSelect.value = String(val);
      if (panelSelect) panelSelect.value = String(val);
      this.renderProspects();
    };
    document.getElementById('ja-filter-score')?.addEventListener('change', syncFilter);
    document.getElementById('ja-score')?.addEventListener('change', syncFilter);
    document.getElementById('ja-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('ja-copy-letter')?.addEventListener('click', () => this.copyLetter());
    document.getElementById('ja-edit-letter')?.addEventListener('click', () => this.toggleEditMode());
    document.getElementById('ja-save-letter')?.addEventListener('click', () => this.saveLetter());

    document.getElementById('ja-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'ja-modal') this.closeModal();
    });

    // PDF upload via click
    const dropZone = document.getElementById('ja-cv-drop');
    const fileInput = document.getElementById('ja-cv-input') as HTMLInputElement;

    dropZone?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) this.handlePdfFile(file);
    });

    // Drag & drop
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('ja-cv-drop-active');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('ja-cv-drop-active');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('ja-cv-drop-active');
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (file?.type === 'application/pdf') this.handlePdfFile(file);
    });
  }

  private async handlePdfFile(file: File) {
    const statusEl = document.getElementById('ja-cv-status');
    const labelEl = document.getElementById('ja-cv-label');

    if (labelEl) labelEl.textContent = `Lecture de "${file.name}"...`;
    if (statusEl) statusEl.textContent = '';

    try {
      const text = await this.extractPdfText(file);
      const textarea = document.getElementById('ja-profile') as HTMLTextAreaElement;
      if (textarea) textarea.value = text;
      localStorage.setItem(PROFILE_KEY, text);

      if (labelEl) labelEl.innerHTML = `<strong>${file.name}</strong> importé`;
      if (statusEl) {
        statusEl.textContent = `${text.length} caractères extraits`;
        statusEl.style.color = '#10b981';
      }
    } catch {
      if (labelEl) labelEl.innerHTML = `Déposer votre CV (PDF) ou <u>cliquer ici</u>`;
      if (statusEl) {
        statusEl.textContent = 'Erreur de lecture du PDF';
        statusEl.style.color = '#ef4444';
      }
    }
  }

  private async extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) textParts.push(pageText);
    }

    return textParts.join('\n\n').substring(0, 6000);
  }

  private async startSearch() {
    if (this.isSearching) return;

    const keyword = (document.getElementById('ja-keyword') as HTMLInputElement)?.value.trim();
    const location = (document.getElementById('ja-location') as HTMLInputElement)?.value.trim() || 'France';
    const maxPages = parseInt((document.getElementById('ja-pages') as HTMLSelectElement)?.value || '2');
    const scoreThreshold = parseInt((document.getElementById('ja-score') as HTMLSelectElement)?.value || '70');
    const source = (document.getElementById('ja-source') as HTMLSelectElement)?.value || 'indeed';
    const cvText = (document.getElementById('ja-profile') as HTMLTextAreaElement)?.value.trim();
    const linkedin = (document.getElementById('ja-linkedin') as HTMLInputElement)?.value.trim();
    const generateLetters = (document.getElementById('ja-letters') as HTMLInputElement)?.checked;

    if (!keyword) {
      (window as any).showToast?.('warning', 'Entrez un poste à rechercher');
      return;
    }
    if (!cvText && !linkedin) {
      (window as any).showToast?.('warning', 'Importez votre CV PDF ou renseignez votre LinkedIn');
      return;
    }

    // Build userProfile from CV text + LinkedIn URL
    const parts: string[] = [];
    if (cvText) parts.push(cvText);
    if (linkedin) parts.push(`Profil LinkedIn: ${linkedin}`);
    const userProfile = parts.join('\n\n');

    if (linkedin) localStorage.setItem(PROFILE_KEY + '-linkedin', linkedin);

    this.setLoading(true, 'Scraping Indeed en cours...');

    try {
      const res = await api.post('/job-agent/search', {
        keyword, location, maxPages, scoreThreshold, userProfile, generateLetters, source,
      });

      this.setLoading(false);
      (window as any).showToast?.('success', res.data.message);
      await this.loadProspects();
    } catch (err: any) {
      this.setLoading(false);
      const msg = err.response?.data?.message || 'Erreur lors de la recherche';
      (window as any).showToast?.('error', msg);
    }
  }

  private async loadProspects() {
    try {
      const res = await api.get<Prospect[]>('/job-agent/prospects');
      this.prospects = res.data;
      this.renderProspects();
    } catch {
      // silently ignore
    }
  }

  private renderProspects() {
    const list = document.getElementById('ja-results-list');
    const count = document.getElementById('ja-count');
    if (!list) return;

    const filtered = this.filterScore > 0
      ? this.prospects.filter(p => p.match_score >= this.filterScore)
      : this.prospects;

    if (count) {
      count.textContent = this.filterScore > 0
        ? `${filtered.length} / ${this.prospects.length} offre(s)`
        : `${this.prospects.length} offre(s)`;
    }

    if (this.prospects.length === 0) {
      list.innerHTML = `
        <div class="ja-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <p>Lance une recherche pour voir les offres analysées par l'IA</p>
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="ja-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <p>Aucune offre avec un score ≥ ${this.filterScore}.<br><small>Baisse le filtre pour en voir davantage.</small></p>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(p => this.buildProspectCard(p)).join('');

    filtered.forEach(p => {
      document.getElementById(`ja-apply-${p.id}`)?.addEventListener('click', () => this.applyToProspect(p.id, p.title, p.company, p.source_url));
      document.getElementById(`ja-letter-${p.id}`)?.addEventListener('click', () => this.showLetter(p));
      document.getElementById(`ja-delete-${p.id}`)?.addEventListener('click', () => this.deleteProspect(p.id));
    });
  }

  private buildProspectCard(p: Prospect): string {
    const scoreClass = p.match_score >= 80 ? 'score-high' : p.match_score >= 60 ? 'score-mid' : 'score-low';
    const statusBadge = p.status === 'applied' ? '<span class="ja-status-badge applied">Postulé</span>' : '';

    const skillsReq = (p.skills_required || []).slice(0, 5).map(s =>
      `<span class="ja-skill ja-skill-ok">${s}</span>`).join('');
    const skillsMiss = (p.skills_missing || []).slice(0, 3).map(s =>
      `<span class="ja-skill ja-skill-miss">${s}</span>`).join('');

    const letterBtn = p.cover_letter
      ? `<button class="ja-btn-ghost" id="ja-letter-${p.id}">Voir la lettre</button>`
      : `<button class="ja-btn-ghost" id="ja-letter-${p.id}">Générer lettre</button>`;

    const applyBtn = p.status !== 'applied'
      ? `<button class="ja-btn-primary" id="ja-apply-${p.id}">Postuler</button>`
      : '';

    return `
      <div class="ja-card ${p.status === 'applied' ? 'ja-card-applied' : ''}">
        <div class="ja-card-top">
          <div class="ja-card-score ${scoreClass}" title="Score de compatibilité IA — probabilité d'être retenu en entretien (0–100)">
            <span class="ja-score-num">${p.match_score}</span>
            <span class="ja-score-pct">%</span>
          </div>
          <div class="ja-card-info">
            <div class="ja-card-title">${p.title}</div>
            <div class="ja-card-meta">${p.company} · ${p.location || '—'}</div>
            <div class="ja-card-tags">
              <span class="ja-tag">${p.job_type || 'CDI'}</span>
              <span class="ja-tag">${p.seniority || 'Junior'}</span>
              ${statusBadge}
            </div>
          </div>
          <div class="ja-card-actions-top">
            <button class="ja-icon-btn" id="ja-delete-${p.id}" title="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        ${p.why_apply ? `<p class="ja-card-why">${p.why_apply}</p>` : ''}

        <div class="ja-skills-row">
          ${skillsReq}${skillsMiss}
        </div>

        <div class="ja-card-footer">
          <a href="${p.source_url}" target="_blank" class="ja-link">Voir l'offre ↗</a>
          <div class="ja-card-btns">
            ${letterBtn}
            ${applyBtn}
          </div>
        </div>
      </div>`;
  }

  private async applyToProspect(id: string, title: string, company: string, sourceUrl?: string) {
    try {
      await api.post(`/job-agent/prospects/${id}/apply`);
      // Open the job listing so the user can actually submit their application
      if (sourceUrl) window.open(sourceUrl, '_blank', 'noopener,noreferrer');
      (window as any).showToast?.('success', `Suivi créé — l'offre s'ouvre pour que tu puisses postuler sur Indeed`);
      await this.loadProspects();
    } catch (err: any) {
      (window as any).showToast?.('error', err.response?.data?.message || 'Erreur');
    }
  }

  private async deleteProspect(id: string) {
    try {
      await api.delete(`/job-agent/prospects/${id}`);
      await this.loadProspects();
    } catch {
      (window as any).showToast?.('error', 'Erreur suppression');
    }
  }

  private async showLetter(p: Prospect) {
    const modal = document.getElementById('ja-modal');
    const body = document.getElementById('ja-modal-body');
    if (!modal || !body) return;

    this.currentProspectId = p.id;
    this.isEditing = false;
    this.setEditMode(false);

    if (p.cover_letter) {
      body.textContent = p.cover_letter;
      modal.style.display = 'flex';
      return;
    }

    // No letter yet — generate it
    const cvText = (document.getElementById('ja-profile') as HTMLTextAreaElement)?.value.trim()
      || localStorage.getItem(PROFILE_KEY) || '';
    const linkedin = (document.getElementById('ja-linkedin') as HTMLInputElement)?.value.trim()
      || localStorage.getItem(PROFILE_KEY + '-linkedin') || '';

    if (!cvText && !linkedin) {
      (window as any).showToast?.('warning', 'Importez votre CV pour générer la lettre');
      return;
    }

    const parts: string[] = [];
    if (cvText) parts.push(cvText);
    if (linkedin) parts.push(`Profil LinkedIn: ${linkedin}`);
    const userProfile = parts.join('\n\n');

    body.textContent = 'Génération en cours...';
    modal.style.display = 'flex';

    try {
      const res = await api.post(`/job-agent/prospects/${p.id}/generate-letter`, { userProfile });
      body.textContent = res.data.cover_letter || '';
      // Update prospect in local list
      p.cover_letter = res.data.cover_letter;
    } catch (err: any) {
      body.textContent = '';
      this.closeModal();
      (window as any).showToast?.('error', err.response?.data?.message || 'Erreur génération lettre');
    }
  }

  private closeModal() {
    const modal = document.getElementById('ja-modal');
    if (modal) modal.style.display = 'none';
    this.isEditing = false;
    this.setEditMode(false);
    this.currentProspectId = null;
  }

  private copyLetter() {
    const body = document.getElementById('ja-modal-body');
    const editor = document.getElementById('ja-modal-editor') as HTMLTextAreaElement;
    const text = this.isEditing ? editor?.value : body?.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text);
    (window as any).showToast?.('success', 'Lettre copiée dans le presse-papiers');
  }

  private toggleEditMode() {
    this.isEditing = !this.isEditing;
    this.setEditMode(this.isEditing);
  }

  private setEditMode(editing: boolean) {
    const body = document.getElementById('ja-modal-body');
    const editor = document.getElementById('ja-modal-editor') as HTMLTextAreaElement;
    const editBtn = document.getElementById('ja-edit-letter');
    const saveBtn = document.getElementById('ja-save-letter');

    if (!body || !editor) return;

    if (editing) {
      editor.value = body.textContent || '';
      body.style.display = 'none';
      editor.style.display = 'block';
      editor.focus();
      if (editBtn) editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg> Annuler`;
      if (saveBtn) saveBtn.style.display = 'flex';
    } else {
      if (editor.value && editor.style.display !== 'none') {
        body.textContent = editor.value;
      }
      body.style.display = 'block';
      editor.style.display = 'none';
      if (editBtn) editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg> Modifier`;
      if (saveBtn) saveBtn.style.display = 'none';
    }
  }

  private async saveLetter() {
    const editor = document.getElementById('ja-modal-editor') as HTMLTextAreaElement;
    const newText = editor?.value.trim();
    if (!newText || !this.currentProspectId) return;

    const saveBtn = document.getElementById('ja-save-letter') as HTMLButtonElement;
    if (saveBtn) saveBtn.disabled = true;

    try {
      await api.patch(`/job-agent/prospects/${this.currentProspectId}/letter`, { cover_letter: newText });

      // Update local cache
      const prospect = this.prospects.find(p => p.id === this.currentProspectId);
      if (prospect) prospect.cover_letter = newText;

      this.isEditing = false;
      this.setEditMode(false);
      (window as any).showToast?.('success', 'Lettre sauvegardée');
    } catch {
      (window as any).showToast?.('error', 'Erreur lors de la sauvegarde');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  private setLoading(loading: boolean, msg = '') {
    this.isSearching = loading;
    const btn = document.getElementById('ja-search-btn') as HTMLButtonElement;
    const loadingEl = document.getElementById('ja-loading');
    const msgEl = document.getElementById('ja-loading-msg');

    if (btn) btn.disabled = loading;
    if (loadingEl) loadingEl.style.display = loading ? 'flex' : 'none';
    if (msgEl) msgEl.textContent = msg;
  }
}
