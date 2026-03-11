/**
 * auth-state.js
 * Gestion de l'état d'authentification Supabase sur les pages publiques.
 * - Adapte le header (boutons Se connecter / Mon espace / Déconnexion)
 * - Déconnecte automatiquement après 30 min d'inactivité
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL      = 'https://owiwkxcwutaprgndlkhp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rr2bz-6nDx-vilDTvskaGg_wx7UiMMa';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Inactivity timer ────────────────────────────────────────────────────────

let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    await supabase.auth.signOut();
    window.location.reload();
  }, INACTIVITY_TIMEOUT_MS);
}

function startInactivityWatch() {
  const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
  events.forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

// ── Header state ────────────────────────────────────────────────────────────

function applyAuthenticatedState() {
  const loginBtn = document.getElementById('loginBtn');
  const ctaBtn   = document.getElementById('ctaBtn');

  if (loginBtn) {
    loginBtn.href        = '/app';
    loginBtn.textContent = 'Mon espace';
  }

  if (ctaBtn) {
    ctaBtn.href      = '#';
    ctaBtn.innerHTML = 'Déconnexion';
    ctaBtn.classList.replace('btn-primary', 'btn-outline');
    ctaBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    });
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

async function initAuthState() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    applyAuthenticatedState();
    startInactivityWatch();
  }
}

initAuthState();
