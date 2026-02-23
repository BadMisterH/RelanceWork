import type { Application } from '../main';
import api from '../lib/api';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateSettings {
  lastUsedTemplateId: string;
}

interface DiagnosticResult {
  points_forts: string[];
  points_adapter: string[];
  conseils_relance: string[];
}

export class TemplateManager {
  private static readonly STORAGE_KEY = 'relancework-email-templates';
  private static readonly SETTINGS_KEY = 'relancework-template-settings';

  private panelOverlay: HTMLElement | null;
  private panelContent: HTMLElement | null;
  private templates: EmailTemplate[] = [];
  private selectedTemplateId: string | null = null;
  private currentApp: Application | null = null;
  private isEditing = false;
  private editingTemplateId: string | null = null;

  // Advisor state
  private advisorExpanded = false;
  private advisorLoading = false;
  private advisorResult: DiagnosticResult | null = null;
  private advisorError: string | null = null;
  private advisorCvFile: File | null = null;
  private advisorJobUrl = '';

  constructor() {
    this.panelOverlay = document.getElementById('templatePanelOverlay');
    this.panelContent = document.getElementById('templatePanel');
    this.templates = this.loadTemplates();
    this.initCloseEvents();
  }

  // ============================================
  // PUBLIC API
  // ============================================

  public open(app: Application): void {
    this.currentApp = app;
    this.isEditing = false;
    this.editingTemplateId = null;

    // Reset advisor state
    this.advisorExpanded = false;
    this.advisorLoading = false;
    this.advisorResult = null;
    this.advisorError = null;
    this.advisorCvFile = null;
    this.advisorJobUrl = app.company_website || '';

    // Pre-select last used template or first one
    const settings = this.loadSettings();
    if (settings.lastUsedTemplateId && this.templates.find(t => t.id === settings.lastUsedTemplateId)) {
      this.selectedTemplateId = settings.lastUsedTemplateId;
    } else {
      this.selectedTemplateId = this.templates[0]?.id || null;
    }

    this.renderPanel();
    this.panelOverlay?.classList.add('active');
  }

  public close(): void {
    this.panelOverlay?.classList.remove('active');
    this.isEditing = false;
    this.editingTemplateId = null;
    this.advisorExpanded = false;
    this.advisorResult = null;
    this.advisorError = null;
    this.advisorCvFile = null;
  }

  // ============================================
  // TEMPLATE CRUD (localStorage)
  // ============================================

  private loadTemplates(): EmailTemplate[] {
    try {
      const stored = localStorage.getItem(TemplateManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as EmailTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore parse errors */ }

    const defaults = this.getDefaultTemplates();
    this.templates = defaults;
    this.saveTemplates();
    return defaults;
  }

  private saveTemplates(): void {
    localStorage.setItem(TemplateManager.STORAGE_KEY, JSON.stringify(this.templates));
  }

  private loadSettings(): TemplateSettings {
    try {
      const stored = localStorage.getItem(TemplateManager.SETTINGS_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { lastUsedTemplateId: '' };
  }

  private saveSettings(settings: TemplateSettings): void {
    localStorage.setItem(TemplateManager.SETTINGS_KEY, JSON.stringify(settings));
  }

  private getDefaultTemplates(): EmailTemplate[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'default-relance',
        name: 'Relance classique',
        subject: 'Relance - Candidature {{poste}} chez {{company}}',
        body:
          `Bonjour,\n\n` +
          `Je me permets de revenir vers vous concernant ma candidature au poste de {{poste}} chez {{company}}.\n\n` +
          `Je reste très intéressé(e) par cette opportunité et serais ravi(e) d'échanger avec vous à ce sujet.\n\n` +
          `Dans l'attente de votre retour, je vous souhaite une excellente journée.\n\n` +
          `{{signature}}`,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-post-entretien',
        name: 'Relance post-entretien',
        subject: 'Suite à notre entretien - {{poste}} chez {{company}}',
        body:
          `Bonjour,\n\n` +
          `Je souhaitais vous remercier pour l'entretien que nous avons eu concernant le poste de {{poste}} chez {{company}}.\n\n` +
          `Notre échange a renforcé mon intérêt pour cette opportunité et je suis convaincu(e) que mon profil correspond aux attentes du poste.\n\n` +
          `Je reste à votre disposition pour toute information complémentaire.\n\n` +
          `{{signature}}`,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-spontanee',
        name: 'Candidature spontanée',
        subject: 'Candidature spontanée - {{poste}} chez {{company}}',
        body:
          `Bonjour,\n\n` +
          `Je me permets de vous contacter car je suis très intéressé(e) par {{company}} et les opportunités que vous proposez dans le domaine de {{poste}}.\n\n` +
          `Mon expérience et mes compétences me permettent de croire que je pourrais contribuer efficacement à votre équipe.\n\n` +
          `Seriez-vous disponible pour un échange ?\n\n` +
          `{{signature}}`,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private createTemplate(name: string, subject: string, body: string): EmailTemplate {
    const template: EmailTemplate = {
      id: crypto.randomUUID(),
      name,
      subject,
      body,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates.push(template);
    this.saveTemplates();
    return template;
  }

  private updateTemplate(id: string, updates: Partial<Pick<EmailTemplate, 'name' | 'subject' | 'body'>>): void {
    const template = this.templates.find(t => t.id === id);
    if (!template) return;
    Object.assign(template, updates, { updatedAt: new Date().toISOString() });
    this.saveTemplates();
  }

  private deleteTemplate(id: string): void {
    const template = this.templates.find(t => t.id === id);
    if (!template || template.isDefault) return;
    this.templates = this.templates.filter(t => t.id !== id);
    this.saveTemplates();

    if (this.selectedTemplateId === id) {
      this.selectedTemplateId = this.templates[0]?.id || null;
    }
  }

  // ============================================
  // VARIABLE REPLACEMENT
  // ============================================

  private replaceVariables(text: string, app: Application): string {
    const profile = this.getUserProfile();
    const formattedDate = app.date
      ? new Date(app.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    return text
      .replace(/\{\{company\}\}/g, app.company || '')
      .replace(/\{\{poste\}\}/g, app.poste || '')
      .replace(/\{\{date\}\}/g, formattedDate)
      .replace(/\{\{nom\}\}/g, profile.name)
      .replace(/\{\{signature\}\}/g, profile.signature)
      .replace(/\{\{titre\}\}/g, profile.title)
      .replace(/\{\{telephone\}\}/g, profile.phone)
      .replace(/\{\{linkedin\}\}/g, profile.linkedin);
  }

  private highlightVariables(text: string, app: Application): string {
    const escaped = this.escapeHtml(text);
    const profile = this.getUserProfile();
    const formattedDate = app.date
      ? new Date(app.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const replacements: Record<string, string> = {
      '{{company}}': app.company || '',
      '{{poste}}': app.poste || '',
      '{{date}}': formattedDate,
      '{{nom}}': profile.name,
      '{{signature}}': profile.signature,
      '{{titre}}': profile.title,
      '{{telephone}}': profile.phone,
      '{{linkedin}}': profile.linkedin,
    };

    let result = escaped;
    for (const [variable, value] of Object.entries(replacements)) {
      const escapedVar = this.escapeHtml(variable);
      if (value) {
        result = result.replace(
          new RegExp(this.escapeRegex(escapedVar), 'g'),
          `<span class="template-var-replaced">${this.escapeHtml(value)}</span>`
        );
      } else {
        result = result.replace(
          new RegExp(this.escapeRegex(escapedVar), 'g'),
          `<span class="template-var-missing">${escapedVar}</span>`
        );
      }
    }

    return result.replace(/\n/g, '<br>');
  }

  private getUserProfile(): { name: string; title: string; phone: string; linkedin: string; signature: string } {
    try {
      const stored = localStorage.getItem('relancework-user-profile');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { name: '', title: '', phone: '', linkedin: '', signature: '' };
  }


  // ============================================
  // RENDERING
  // ============================================

  private renderPanel(): void {
    if (!this.panelContent || !this.currentApp) return;

    const app = this.currentApp;
    const selectedTemplate = this.templates.find(t => t.id === this.selectedTemplateId);

    this.panelContent.innerHTML = `
      <!-- Header -->
      <div class="template-panel-header">
        <div class="template-panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <h3>Template d'email</h3>
        </div>
        <button class="panel-close-btn" id="closeTemplatePanelBtn" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Context Bar -->
      <div class="template-context">
        <span class="template-context-dot"></span>
        Relance pour <strong>${this.escapeHtml(app.poste)}</strong> chez <strong>${this.escapeHtml(app.company)}</strong>
        ${app.email ? ` &mdash; ${this.escapeHtml(app.email)}` : ''}
      </div>

      <!-- Body: Sidebar + Main -->
      <div class="template-panel-body">
        <!-- Sidebar: Template List -->
        <div class="template-sidebar">
          <div class="template-sidebar-header">Mes templates</div>
          <div class="template-list">
            ${this.renderTemplateList()}
          </div>
          <button class="template-btn-new" id="newTemplateBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau
          </button>
        </div>

        <!-- Main: Preview or Editor -->
        <div class="template-main">
          ${this.isEditing ? this.renderEditor() : this.renderPreview(selectedTemplate)}
        </div>
      </div>

      <!-- Advisor (optionnel) -->
      ${!this.isEditing ? this.renderAdvisorSection() : ''}

      <!-- Actions -->
      <div class="template-actions">
        ${this.isEditing ? `
          <button class="template-btn-save" id="saveTemplateBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Enregistrer
          </button>
          <button class="template-btn-cancel" id="cancelEditBtn">Annuler</button>
        ` : `
          <button class="template-btn-mailto" id="sendGmailBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Envoyer via Gmail
          </button>
          <button class="template-btn-copy" id="copyTemplateBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copier
          </button>
        `}
      </div>
    `;

    this.attachPanelEvents();
  }

  private renderTemplateList(): string {
    return this.templates.map(t => {
      const isActive = t.id === this.selectedTemplateId;
      const preview = t.body.substring(0, 60).replace(/\n/g, ' ');

      return `
        <div class="template-card ${isActive ? 'template-card--active' : ''}"
             data-template-id="${t.id}" tabindex="0">
          <div class="template-card-name">
            <span>${this.escapeHtml(t.name)}</span>
            ${t.isDefault
              ? '<span class="template-badge-default">Défaut</span>'
              : `<button class="template-btn-delete" data-delete-id="${t.id}" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>`
            }
          </div>
          <div class="template-card-preview">${this.escapeHtml(preview)}...</div>
        </div>
      `;
    }).join('');
  }

  private renderPreview(template: EmailTemplate | undefined): string {
    if (!template || !this.currentApp) {
      return `
        <div class="template-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <p>Sélectionnez un template pour prévisualiser</p>
        </div>
      `;
    }

    const highlightedSubject = this.highlightVariables(template.subject, this.currentApp);
    const highlightedBody = this.highlightVariables(template.body, this.currentApp);

    return `
      <div class="template-preview">
        <button class="template-preview-edit-btn" id="editTemplateBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Modifier ce template
        </button>
        <div class="template-preview-label">Objet</div>
        <div class="template-preview-subject">${highlightedSubject}</div>
        <div class="template-preview-label">Corps du message</div>
        <div class="template-preview-body">${highlightedBody}</div>
      </div>
    `;
  }

  private renderEditor(): string {
    const template = this.templates.find(t => t.id === this.editingTemplateId);
    const name = template?.name || '';
    const subject = template?.subject || 'Relance - {{poste}} chez {{company}}';
    const body = template?.body || `Bonjour,\n\n\n\n{{signature}}`;

    return `
      <div class="template-editor">
        <div class="template-variables-hint">
          <span>Variables :</span>
          <code data-var="{{company}}">{{company}}</code>
          <code data-var="{{poste}}">{{poste}}</code>
          <code data-var="{{date}}">{{date}}</code>
          <code data-var="{{nom}}">{{nom}}</code>
          <code data-var="{{signature}}">{{signature}}</code>
          <code data-var="{{titre}}">{{titre}}</code>
          <code data-var="{{telephone}}">{{telephone}}</code>
          <code data-var="{{linkedin}}">{{linkedin}}</code>
        </div>
        <div class="template-editor-field">
          <label for="templateName">Nom du template</label>
          <input type="text" id="templateName" value="${this.escapeAttr(name)}" placeholder="Ex: Relance entreprise tech">
        </div>
        <div class="template-editor-field">
          <label for="templateSubject">Objet de l'email</label>
          <input type="text" id="templateSubject" value="${this.escapeAttr(subject)}" placeholder="Ex: Relance - {{poste}} chez {{company}}">
        </div>
        <div class="template-editor-field">
          <label for="templateBody">Corps du message</label>
          <textarea id="templateBody" placeholder="Rédigez votre template ici...">${this.escapeHtml(body)}</textarea>
        </div>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLING
  // ============================================

  private initCloseEvents(): void {
    // Close on overlay click
    this.panelOverlay?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.panelOverlay) {
        this.close();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.panelOverlay?.classList.contains('active')) {
        this.close();
      }
    });
  }

  private attachPanelEvents(): void {
    // Close button
    document.getElementById('closeTemplatePanelBtn')?.addEventListener('click', () => this.close());

    // Template card selection
    this.panelContent?.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        // Don't select if clicking delete button
        if (target.closest('.template-btn-delete')) return;

        const id = (card as HTMLElement).dataset.templateId;
        if (id) this.handleTemplateSelect(id);
      });
    });

    // Delete buttons
    this.panelContent?.querySelectorAll('.template-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.deleteId;
        if (id) this.handleDeleteTemplate(id);
      });
    });

    // New template button
    document.getElementById('newTemplateBtn')?.addEventListener('click', () => this.handleNewTemplate());

    // Edit template button
    document.getElementById('editTemplateBtn')?.addEventListener('click', () => this.handleEditTemplate());

    // Save template button
    document.getElementById('saveTemplateBtn')?.addEventListener('click', () => this.handleSaveTemplate());

    // Cancel edit button
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
      this.isEditing = false;
      this.editingTemplateId = null;
      this.renderPanel();
    });

    // Advisor toggle
    document.getElementById('advisorToggleBtn')?.addEventListener('click', () => {
      this.advisorExpanded = !this.advisorExpanded;
      this.renderPanel();
    });

    // Advisor body events (if expanded)
    if (this.advisorExpanded) this.attachAdvisorBodyEvents();

    // Send via Gmail button
    document.getElementById('sendGmailBtn')?.addEventListener('click', () => this.handleSendViaGmail());

    // Copy button
    document.getElementById('copyTemplateBtn')?.addEventListener('click', () => this.handleCopyToClipboard());

    // Variable hint click-to-insert
    this.panelContent?.querySelectorAll('.template-variables-hint code').forEach(code => {
      code.addEventListener('click', () => {
        const varText = (code as HTMLElement).dataset.var;
        const bodyTextarea = document.getElementById('templateBody') as HTMLTextAreaElement | null;
        if (varText && bodyTextarea) {
          const start = bodyTextarea.selectionStart;
          const end = bodyTextarea.selectionEnd;
          const text = bodyTextarea.value;
          bodyTextarea.value = text.substring(0, start) + varText + text.substring(end);
          bodyTextarea.selectionStart = bodyTextarea.selectionEnd = start + varText.length;
          bodyTextarea.focus();
        }
      });
    });
  }

  private handleTemplateSelect(id: string): void {
    this.selectedTemplateId = id;
    this.isEditing = false;
    this.editingTemplateId = null;
    this.renderPanel();
  }

  private handleNewTemplate(): void {
    this.isEditing = true;
    this.editingTemplateId = null; // null = creating new
    this.renderPanel();
  }

  private handleEditTemplate(): void {
    if (!this.selectedTemplateId) return;
    this.isEditing = true;
    this.editingTemplateId = this.selectedTemplateId;
    this.renderPanel();
  }

  private handleSaveTemplate(): void {
    const nameInput = document.getElementById('templateName') as HTMLInputElement | null;
    const subjectInput = document.getElementById('templateSubject') as HTMLInputElement | null;
    const bodyInput = document.getElementById('templateBody') as HTMLTextAreaElement | null;

    const name = nameInput?.value.trim() || '';
    const subject = subjectInput?.value.trim() || '';
    const body = bodyInput?.value || '';

    if (!name) {
      this.showToast('Le nom du template est requis', 'error');
      nameInput?.focus();
      return;
    }

    if (!subject) {
      this.showToast("L'objet est requis", 'error');
      subjectInput?.focus();
      return;
    }

    if (this.editingTemplateId) {
      // Update existing
      this.updateTemplate(this.editingTemplateId, { name, subject, body });
      this.showToast('Template mis à jour', 'success');
    } else {
      // Create new
      const newTemplate = this.createTemplate(name, subject, body);
      this.selectedTemplateId = newTemplate.id;
      this.showToast('Template créé', 'success');
    }

    this.isEditing = false;
    this.editingTemplateId = null;
    this.renderPanel();
  }

  private handleDeleteTemplate(id: string): void {
    const template = this.templates.find(t => t.id === id);
    if (!template || template.isDefault) return;

    if (!confirm(`Supprimer le template "${template.name}" ?`)) return;

    this.deleteTemplate(id);
    this.showToast('Template supprimé', 'success');
    this.renderPanel();
  }

  private async handleSendViaGmail(): Promise<void> {
    if (!this.currentApp || !this.selectedTemplateId) return;

    const template = this.templates.find(t => t.id === this.selectedTemplateId);
    if (!template) return;

    const to = this.currentApp.email || '';
    if (!to) {
      this.showToast("Pas d'adresse email pour cette candidature", 'error');
      return;
    }

    const subject = this.replaceVariables(template.subject, this.currentApp);
    const body = this.replaceVariables(template.body, this.currentApp);

    // État loading sur le bouton
    const btn = document.getElementById('sendGmailBtn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <div style="width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Envoi en cours...
      `;
    }

    try {
      await api.post('/gmail-user/send-email', { to, subject, body });

      // Save preference
      this.saveSettings({ lastUsedTemplateId: template.id });

      // Notify main.ts pour incrémenter le compteur
      window.dispatchEvent(new CustomEvent('relance-sent', { detail: { id: this.currentApp.id } }));

      this.showToast('Email envoyé avec succès', 'success');
      this.close();
    } catch (error: any) {
      const isGmailNotConnected = error?.response?.data?.gmail_not_connected;

      if (isGmailNotConnected) {
        this.showToast('Connectez votre Gmail dans les paramètres', 'error');
      } else {
        this.showToast(error?.response?.data?.error || "Erreur lors de l'envoi", 'error');
      }

      // Restaurer le bouton
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Envoyer via Gmail
        `;
      }
    }
  }

  private handleCopyToClipboard(): void {
    if (!this.currentApp || !this.selectedTemplateId) return;

    const template = this.templates.find(t => t.id === this.selectedTemplateId);
    if (!template) return;

    const subject = this.replaceVariables(template.subject, this.currentApp);
    const body = this.replaceVariables(template.body, this.currentApp);
    const fullText = `Objet : ${subject}\n\n${body}`;

    navigator.clipboard.writeText(fullText).then(() => {
      this.showToast('Copié dans le presse-papier', 'success');
    }).catch(() => {
      this.showToast('Erreur lors de la copie', 'error');
    });

    // Save preference
    this.saveSettings({ lastUsedTemplateId: template.id });

    // Notify main.ts
    window.dispatchEvent(new CustomEvent('relance-sent', { detail: { id: this.currentApp.id } }));
  }

  // ============================================
  // ADVISOR RENDERING
  // ============================================

  private renderAdvisorSection(): string {
    return `
      <div class="template-advisor" id="advisorSection">
        <button class="template-advisor-toggle" id="advisorToggleBtn" aria-expanded="${this.advisorExpanded}">
          <span class="advisor-toggle-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Analyser avant d'envoyer
            <span class="advisor-badge-optional">Optionnel</span>
          </span>
          <svg class="advisor-chevron${this.advisorExpanded ? ' advisor-chevron--open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        ${this.advisorExpanded ? `<div class="template-advisor-body">${
          this.advisorLoading
            ? this.renderAdvisorLoading()
            : this.advisorResult
              ? this.renderAdvisorResult()
              : this.renderAdvisorForm()
        }</div>` : ''}
      </div>
    `;
  }

  private renderAdvisorForm(): string {
    const hasFile = !!this.advisorCvFile;
    const hasUrl = !!this.advisorJobUrl.trim();
    return `
      <p class="advisor-form-intro">Analyse de compatibilité entre votre CV et la fiche de poste — pour personnaliser votre relance.</p>
      <div class="template-advisor-form">
        <div class="advisor-form-field">
          <label>Votre CV (PDF)</label>
          <label class="advisor-file-label" for="advisorCvInput">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span id="advisorFileLabel">${hasFile ? this.escapeHtml(this.advisorCvFile!.name) : 'Choisir un PDF…'}</span>
          </label>
          <input type="file" id="advisorCvInput" accept=".pdf,application/pdf" class="advisor-file-input">
        </div>
        <div class="advisor-form-field">
          <label>URL de la fiche de poste</label>
          <input type="url" id="advisorJobUrlInput" value="${this.escapeAttr(this.advisorJobUrl)}"
            placeholder="https://www.linkedin.com/jobs/…" class="advisor-url-input">
        </div>
      </div>
      ${this.advisorError ? `<p class="advisor-error">${this.escapeHtml(this.advisorError)}</p>` : ''}
      <button class="advisor-analyze-btn" id="advisorAnalyzeBtn" ${!hasFile || !hasUrl ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Analyser mon profil
      </button>
    `;
  }

  private renderAdvisorLoading(): string {
    return `
      <div class="advisor-loading">
        <div class="advisor-spinner"></div>
        <span>Analyse en cours…</span>
      </div>
    `;
  }

  private renderAdvisorResult(): string {
    const r = this.advisorResult!;
    const sections = [
      { key: 'points_forts', label: 'Points forts à valoriser', icon: '✓', mod: 'green', items: r.points_forts },
      { key: 'points_adapter', label: 'Points à adapter', icon: '⚠', mod: 'orange', items: r.points_adapter },
      { key: 'conseils_relance', label: 'Conseils pour cette relance', icon: '💡', mod: 'blue', items: r.conseils_relance },
    ];
    return `
      <div class="template-advisor-result">
        ${sections.map(s => s.items.length ? `
          <div class="advisor-result-section advisor-result-section--${s.mod}">
            <div class="advisor-result-title">${s.icon} ${s.label}</div>
            ${s.items.map(item => `<div class="advisor-result-item">${this.escapeHtml(item)}</div>`).join('')}
          </div>
        ` : '').join('')}
        <button class="advisor-reset-btn" id="advisorResetBtn">← Nouvelle analyse</button>
      </div>
    `;
  }

  // ============================================
  // ADVISOR LOGIC
  // ============================================

  private async handleAnalyze(): Promise<void> {
    if (!this.advisorCvFile || !this.advisorJobUrl.trim() || !this.currentApp) return;

    this.advisorLoading = true;
    this.advisorError = null;
    this.updateAdvisorBody();

    try {
      const formData = new FormData();
      formData.append('cv', this.advisorCvFile);
      formData.append('jobUrl', this.advisorJobUrl.trim());
      formData.append('company', this.currentApp.company);
      formData.append('poste', this.currentApp.poste);

      const response = await api.post('/relance-advisor/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      this.advisorResult = response.data as DiagnosticResult;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      this.advisorError = err?.response?.data?.error || "Erreur lors de l'analyse. Réessayez.";
    } finally {
      this.advisorLoading = false;
      this.updateAdvisorBody();
    }
  }

  private updateAdvisorBody(): void {
    const bodyEl = document.querySelector('#advisorSection .template-advisor-body');
    if (!bodyEl) return;

    bodyEl.innerHTML = this.advisorLoading
      ? this.renderAdvisorLoading()
      : this.advisorResult
        ? this.renderAdvisorResult()
        : this.renderAdvisorForm();

    this.attachAdvisorBodyEvents();
  }

  private attachAdvisorBodyEvents(): void {
    const fileInput = document.getElementById('advisorCvInput') as HTMLInputElement | null;
    fileInput?.addEventListener('change', () => {
      this.advisorCvFile = fileInput.files?.[0] ?? null;
      const label = document.getElementById('advisorFileLabel');
      if (label) label.textContent = this.advisorCvFile ? this.advisorCvFile.name : 'Choisir un PDF…';
      const analyzeBtn = document.getElementById('advisorAnalyzeBtn') as HTMLButtonElement | null;
      if (analyzeBtn) analyzeBtn.disabled = !this.advisorCvFile || !this.advisorJobUrl.trim();
    });

    const urlInput = document.getElementById('advisorJobUrlInput') as HTMLInputElement | null;
    urlInput?.addEventListener('input', () => {
      this.advisorJobUrl = urlInput.value;
      const analyzeBtn = document.getElementById('advisorAnalyzeBtn') as HTMLButtonElement | null;
      if (analyzeBtn) analyzeBtn.disabled = !this.advisorCvFile || !this.advisorJobUrl.trim();
    });

    document.getElementById('advisorAnalyzeBtn')?.addEventListener('click', () => this.handleAnalyze());
    document.getElementById('advisorResetBtn')?.addEventListener('click', () => {
      this.advisorResult = null;
      this.advisorError = null;
      this.advisorCvFile = null;
      this.updateAdvisorBody();
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    // Remove existing toast
    document.querySelector('.template-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `template-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 300ms ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
