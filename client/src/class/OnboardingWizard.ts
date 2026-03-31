import api from '../lib/api';

const PROFILE_KEY = 'relancework-agent-profile';

interface OnboardingProfile {
  poste: string;
  ville: string;
  experience: 'junior' | 'confirmed' | 'senior';
}

export class OnboardingWizard {
  private currentStep = 1;
  private totalSteps = 3;
  private profile: Partial<OnboardingProfile> = {};
  private onComplete: (() => void) | null = null;

  public async shouldShow(): Promise<boolean> {
    try {
      const { data } = await api.get('/onboarding/status');
      return !data.completed;
    } catch {
      return false;
    }
  }

  public show(onComplete?: () => void): void {
    this.onComplete = onComplete ?? null;
    this.currentStep = 1;
    this.profile = {};
    this.render();
  }

  private render(): void {
    const existing = document.getElementById('onboarding-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = this.buildHTML();
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('onboarding-overlay--visible'));
    this.bindEvents(overlay);
  }

  private buildHTML(): string {
    return `
      <div class="onboarding-modal" role="dialog" aria-modal="true" aria-label="Configuration de ton profil">
        <div class="onboarding-progress">
          ${[1, 2, 3].map(i => `
            <div class="onboarding-step-dot ${i <= this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'done' : ''}"></div>
          `).join('<div class="onboarding-step-line"></div>')}
        </div>
        <div class="onboarding-body">
          ${this.buildStepHTML()}
        </div>
      </div>
    `;
  }

  private buildStepHTML(): string {
    switch (this.currentStep) {
      case 1:
        return `
          <div class="onboarding-step" data-step="1">
            <div class="onboarding-icon">👋</div>
            <h2 class="onboarding-title">Bienvenue sur RelanceWork !</h2>
            <p class="onboarding-subtitle">En 30 secondes, on personnalise ton expérience.</p>
            <div class="onboarding-field">
              <label class="onboarding-label">Quel poste tu recherches ?</label>
              <input
                id="ob-poste"
                type="text"
                class="onboarding-input"
                placeholder="ex: Développeur React, Chef de projet, UX Designer…"
                value="${this.profile.poste ?? ''}"
                autocomplete="off"
              />
            </div>
            <button class="onboarding-btn-primary" id="ob-next-1" ${!this.profile.poste ? 'disabled' : ''}>
              Continuer →
            </button>
          </div>
        `;

      case 2:
        return `
          <div class="onboarding-step" data-step="2">
            <div class="onboarding-icon">📍</div>
            <h2 class="onboarding-title">Où tu cherches ?</h2>
            <p class="onboarding-subtitle">On va cibler les offres dans ta zone.</p>
            <div class="onboarding-field">
              <label class="onboarding-label">Ville ou région</label>
              <input
                id="ob-ville"
                type="text"
                class="onboarding-input"
                placeholder="ex: Paris, Lyon, Remote…"
                value="${this.profile.ville ?? ''}"
                autocomplete="off"
              />
            </div>
            <div class="onboarding-field">
              <label class="onboarding-label">Ton niveau d'expérience</label>
              <div class="onboarding-choices">
                <button class="onboarding-choice ${this.profile.experience === 'junior' ? 'selected' : ''}" data-value="junior">
                  <span class="onboarding-choice-emoji">🌱</span>
                  <span>Junior</span>
                  <small>0–3 ans</small>
                </button>
                <button class="onboarding-choice ${this.profile.experience === 'confirmed' ? 'selected' : ''}" data-value="confirmed">
                  <span class="onboarding-choice-emoji">⚡</span>
                  <span>Confirmé</span>
                  <small>3–7 ans</small>
                </button>
                <button class="onboarding-choice ${this.profile.experience === 'senior' ? 'selected' : ''}" data-value="senior">
                  <span class="onboarding-choice-emoji">🎯</span>
                  <span>Senior</span>
                  <small>7+ ans</small>
                </button>
              </div>
            </div>
            <div class="onboarding-btn-row">
              <button class="onboarding-btn-secondary" id="ob-back-2">← Retour</button>
              <button class="onboarding-btn-primary" id="ob-next-2" ${(!this.profile.ville || !this.profile.experience) ? 'disabled' : ''}>
                Continuer →
              </button>
            </div>
          </div>
        `;

      case 3:
        return `
          <div class="onboarding-step" data-step="3">
            <div class="onboarding-icon">🚀</div>
            <h2 class="onboarding-title">C'est parti !</h2>
            <p class="onboarding-subtitle">
              Ton profil est configuré. Le Job Agent va maintenant chercher des offres pour
              <strong>${this.profile.poste}</strong> à <strong>${this.profile.ville}</strong>.
            </p>
            <div class="onboarding-summary">
              <div class="onboarding-summary-item">
                <span class="onboarding-summary-icon">🎯</span>
                <span>Offres scorées selon ton profil</span>
              </div>
              <div class="onboarding-summary-item">
                <span class="onboarding-summary-icon">✉️</span>
                <span>Lettre de motivation en 10 secondes</span>
              </div>
              <div class="onboarding-summary-item">
                <span class="onboarding-summary-icon">🔔</span>
                <span>Rappels automatiques pour relancer</span>
              </div>
            </div>
            <button class="onboarding-btn-primary onboarding-btn-launch" id="ob-launch">
              Voir mes offres →
            </button>
            <button class="onboarding-btn-ghost" id="ob-skip">Passer pour l'instant</button>
          </div>
        `;

      default:
        return '';
    }
  }

  private bindEvents(overlay: HTMLElement): void {
    // Step 1
    const posteInput = overlay.querySelector<HTMLInputElement>('#ob-poste');
    const next1 = overlay.querySelector<HTMLButtonElement>('#ob-next-1');
    if (posteInput && next1) {
      posteInput.addEventListener('input', () => {
        this.profile.poste = posteInput.value.trim();
        next1.disabled = !this.profile.poste;
      });
      posteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.profile.poste) this.goToStep(2);
      });
      next1.addEventListener('click', () => {
        if (this.profile.poste) this.goToStep(2);
      });
      setTimeout(() => posteInput.focus(), 100);
    }

    // Step 2
    const villeInput = overlay.querySelector<HTMLInputElement>('#ob-ville');
    const next2 = overlay.querySelector<HTMLButtonElement>('#ob-next-2');
    const back2 = overlay.querySelector<HTMLButtonElement>('#ob-back-2');
    const choices = overlay.querySelectorAll<HTMLButtonElement>('.onboarding-choice');

    if (villeInput && next2) {
      villeInput.addEventListener('input', () => {
        this.profile.ville = villeInput.value.trim();
        next2.disabled = !this.profile.ville || !this.profile.experience;
      });
      villeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.profile.ville && this.profile.experience) this.goToStep(3);
      });
      setTimeout(() => villeInput.focus(), 100);
    }

    choices.forEach(btn => {
      btn.addEventListener('click', () => {
        choices.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.profile.experience = btn.dataset['value'] as OnboardingProfile['experience'];
        if (next2) next2.disabled = !this.profile.ville || !this.profile.experience;
      });
    });

    next2?.addEventListener('click', () => {
      if (this.profile.ville && this.profile.experience) this.goToStep(3);
    });

    back2?.addEventListener('click', () => this.goToStep(1));

    // Step 3
    const launchBtn = overlay.querySelector<HTMLButtonElement>('#ob-launch');
    const skipBtn = overlay.querySelector<HTMLButtonElement>('#ob-skip');

    launchBtn?.addEventListener('click', () => this.complete(true));
    skipBtn?.addEventListener('click', () => this.complete(false));
  }

  private goToStep(step: number): void {
    this.currentStep = step;
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const body = overlay.querySelector('.onboarding-body');
    if (body) body.innerHTML = this.buildStepHTML();

    // Update progress dots
    overlay.querySelectorAll('.onboarding-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i < step);
      dot.classList.toggle('done', i < step - 1);
    });

    this.bindEvents(overlay);
  }

  private async complete(launchAgent: boolean): Promise<void> {
    if (this.profile.poste && this.profile.ville && this.profile.experience) {
      try {
        // Save profile to backend
        await api.post('/onboarding/profile', {
          poste: this.profile.poste,
          ville: this.profile.ville,
          experience: this.profile.experience,
        });

        // Pre-fill the Job Agent localStorage profile so it's ready
        const agentProfile = `Poste recherché : ${this.profile.poste}\nVille : ${this.profile.ville}\nExpérience : ${this.profile.experience}`;
        localStorage.setItem(PROFILE_KEY, agentProfile);
      } catch {
        // Non-blocking — wizard still closes
      }
    }

    this.hide();

    if (this.onComplete) this.onComplete();

    if (launchAgent) {
      // Navigate to the Job Agent section
      setTimeout(() => {
        const jobAgentNav = document.querySelector<HTMLElement>('.nav-item[data-section="job-agent"]');
        if (jobAgentNav?.dataset.disabled === 'true') return;
        jobAgentNav?.click();
      }, 300);
    }
  }

  private hide(): void {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    overlay.classList.remove('onboarding-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }
}
