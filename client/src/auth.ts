import "./styles/auth.css";
import { supabase } from "./lib/supabase";

// ============================================
// FORM TOGGLE
// ============================================

const loginFormContainer = document.getElementById("loginForm") as HTMLElement;
const signupFormContainer = document.getElementById("signupForm") as HTMLElement;
const toggleButtons = document.querySelectorAll(".toggle-form");

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-target");

    if (target === "signup") {
      loginFormContainer.classList.remove("active");
      signupFormContainer.classList.add("active");
    } else {
      signupFormContainer.classList.remove("active");
      loginFormContainer.classList.add("active");
    }
  });
});

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================

const passwordToggles = document.querySelectorAll(".password-toggle");

passwordToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const targetId = toggle.getAttribute("data-target");
    const input = document.getElementById(targetId!) as HTMLInputElement;
    const eyeOpen = toggle.querySelector(".eye-open") as SVGElement;
    const eyeClosed = toggle.querySelector(".eye-closed") as SVGElement;

    if (input.type === "password") {
      input.type = "text";
      eyeOpen.style.display = "none";
      eyeClosed.style.display = "block";
    } else {
      input.type = "password";
      eyeOpen.style.display = "block";
      eyeClosed.style.display = "none";
    }
  });
});

// ============================================
// PASSWORD STRENGTH METER
// ============================================

const signupPassword = document.getElementById(
  "signupPassword"
) as HTMLInputElement;
const passwordStrength = document.getElementById(
  "passwordStrength"
) as HTMLElement;
const strengthText = passwordStrength?.querySelector(
  ".strength-text"
) as HTMLElement;

signupPassword?.addEventListener("input", () => {
  const password = signupPassword.value;
  const strength = calculatePasswordStrength(password);

  passwordStrength.className = "password-strength";

  if (password.length === 0) {
    passwordStrength.classList.remove("weak", "medium", "strong");
    strengthText.textContent = "Minimum 8 caractères";
  } else if (strength < 40) {
    passwordStrength.classList.add("weak");
    strengthText.textContent = "Faible";
  } else if (strength < 70) {
    passwordStrength.classList.add("medium");
    strengthText.textContent = "Moyen";
  } else {
    passwordStrength.classList.add("strong");
    strengthText.textContent = "Fort";
  }
});

function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 15;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

  return strength;
}

// ============================================
// AUTH NOTIFICATION SYSTEM
// ============================================
function showAuthNotification(type: 'success' | 'error' | 'info', message: string) {
  // Supprimer une notification existante
  document.querySelector('.auth-notification')?.remove();

  const icons: Record<string, string> = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const colors: Record<string, string> = {
    success: 'linear-gradient(135deg, #10b981, #059669)',
    error: 'linear-gradient(135deg, #ef4444, #dc2626)',
    info: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  };

  const notif = document.createElement('div');
  notif.className = 'auth-notification';
  notif.style.cssText = `
    position: fixed; top: 24px; right: 24px; z-index: 99999;
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; border-radius: 12px;
    background: ${colors[type]}; color: white;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
    max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    animation: authNotifIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    line-height: 1.4;
  `;
  notif.innerHTML = `<span style="flex-shrink:0">${icons[type]}</span><span>${message}</span>`;

  // Ajouter l'animation CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes authNotifIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes authNotifOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = 'authNotifOut 0.3s ease forwards';
    setTimeout(() => { notif.remove(); style.remove(); }, 300);
  }, 5000);
}

// ============================================
// FORM VALIDATION
// ============================================

// Liste des domaines d'emails jetables (même liste que le backend)
const DISPOSABLE_DOMAINS = [
  'temp-mail.org', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
  'maildrop.cc', 'throwaway.email', 'getnada.com', 'trashmail.com',
  'fakeinbox.com', 'sharklasers.com', 'guerrillamail.info', 'grr.la',
  'guerrillamail.biz', 'guerrillamail.de', 'spam4.me', 'mailnesia.com',
  'mytemp.email', 'temp-mail.io', 'mohmal.com', 'throwawaymail.com',
  'yopmail.com', '10minutemail.com', 'emailondeck.com', 'mintemail.com',
  'dispostable.com', 'emailfake.com', 'inboxkitten.com', 'anonymousemail.me',
  'crazymailing.com', 'mailcatch.com', 'mailtothis.com', 'tempinbox.com',
  'incognitomail.com', 'fakemail.net', 'tmails.net', 'tempmail.net',
  'getairmail.com', 'mailsac.com', 'burnermail.io', 'emailtemporanea.net',
  'emailtemporanea.com', 'correotemporal.org'
];

function validateEmail(email: string): boolean {
  // Vérifier le format
  const re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!re.test(email)) return false;

  // Vérifier que ce n'est pas un email jetable
  const domain = email.toLowerCase().split('@')[1];
  return !DISPOSABLE_DOMAINS.includes(domain);
}

function showError(inputId: string, message: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const errorSpan = document.getElementById(inputId + "Error") as HTMLElement;

  input.classList.add("error");
  input.classList.remove("success");
  errorSpan.textContent = message;
}

function showSuccess(inputId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const errorSpan = document.getElementById(inputId + "Error") as HTMLElement;

  input.classList.add("success");
  input.classList.remove("error");
  errorSpan.textContent = "";
}

function clearValidation(inputId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const errorSpan = document.getElementById(inputId + "Error") as HTMLElement;

  input.classList.remove("error", "success");
  errorSpan.textContent = "";
}

// ============================================
// LOGIN FORM SUBMISSION
// ============================================

const loginForm = document.getElementById(
  "loginFormElement"
) as HTMLFormElement;
const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = (document.getElementById("loginEmail") as HTMLInputElement)
    .value;
  const password = (
    document.getElementById("loginPassword") as HTMLInputElement
  ).value;
  const rememberMe = (
    document.getElementById("rememberMe") as HTMLInputElement
  ).checked;

  // Clear previous validations
  clearValidation("loginEmail");
  clearValidation("loginPassword");

  // Validate
  let isValid = true;

  if (!email) {
    showError("loginEmail", "L'email est requis");
    isValid = false;
  } else if (!validateEmail(email)) {
    showError("loginEmail", "Format d'email invalide");
    isValid = false;
  } else {
    showSuccess("loginEmail");
  }

  if (!password) {
    showError("loginPassword", "Le mot de passe est requis");
    isValid = false;
  } else if (password.length < 8) {
    showError("loginPassword", "Le mot de passe doit contenir au moins 8 caractères");
    isValid = false;
  } else {
    showSuccess("loginPassword");
  }

  if (!isValid) return;

  // Show loading state
  loginBtn.classList.add("loading");
  loginBtn.disabled = true;

  try {
    // Connexion avec Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      console.error("Login error:", error);
      showError("loginPassword", error.message || "Email ou mot de passe incorrect");
      return;
    }

    if (data.session) {
      // Supabase gère automatiquement la persistance de la session
      // Si rememberMe est false, on peut configurer la session pour être temporaire
      if (!rememberMe) {
        // Note: Pour une session temporaire, on pourrait utiliser sessionStorage
        // mais Supabase gère déjà la persistance de manière sécurisée
      }

      console.log("✅ Connexion réussie:", data.user?.email);
      // Rediriger vers l'application
      window.location.href = "/";
    }
  } catch (error) {
    console.error("Login error:", error);
    showError("loginPassword", "Erreur de connexion. Veuillez réessayer.");
  } finally {
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;
  }
});

// ============================================
// SIGNUP FORM SUBMISSION
// ============================================

const signupForm = document.getElementById(
  "signupFormElement"
) as HTMLFormElement;
const signupBtn = document.getElementById("signupBtn") as HTMLButtonElement;

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = (document.getElementById("signupName") as HTMLInputElement)
    .value;
  const email = (document.getElementById("signupEmail") as HTMLInputElement)
    .value;
  const password = (
    document.getElementById("signupPassword") as HTMLInputElement
  ).value;
  const confirmPassword = (
    document.getElementById("signupConfirmPassword") as HTMLInputElement
  ).value;
  const acceptTerms = (
    document.getElementById("acceptTerms") as HTMLInputElement
  ).checked;

  // Clear previous validations
  clearValidation("signupName");
  clearValidation("signupEmail");
  clearValidation("signupPassword");
  clearValidation("signupConfirmPassword");

  // Validate
  let isValid = true;

  if (!name || name.trim().length < 2) {
    showError("signupName", "Le nom doit contenir au moins 2 caractères");
    isValid = false;
  } else {
    showSuccess("signupName");
  }

  if (!email) {
    showError("signupEmail", "L'email est requis");
    isValid = false;
  } else if (!validateEmail(email)) {
    const domain = email.toLowerCase().split('@')[1];
    if (DISPOSABLE_DOMAINS.includes(domain)) {
      showError("signupEmail", "Les emails temporaires ne sont pas autorisés. Utilisez un email permanent.");
    } else {
      showError("signupEmail", "Format d'email invalide");
    }
    isValid = false;
  } else {
    showSuccess("signupEmail");
  }

  if (!password) {
    showError("signupPassword", "Le mot de passe est requis");
    isValid = false;
  } else if (password.length < 8) {
    showError(
      "signupPassword",
      "Le mot de passe doit contenir au moins 8 caractères"
    );
    isValid = false;
  } else {
    showSuccess("signupPassword");
  }

  if (!confirmPassword) {
    showError("signupConfirmPassword", "Veuillez confirmer le mot de passe");
    isValid = false;
  } else if (password !== confirmPassword) {
    showError("signupConfirmPassword", "Les mots de passe ne correspondent pas");
    isValid = false;
  } else {
    showSuccess("signupConfirmPassword");
  }

  if (!acceptTerms) {
    showError("signupEmail", "Veuillez accepter les conditions d'utilisation");
    isValid = false;
  }

  if (!isValid) return;

  // Show loading state
  signupBtn.classList.add("loading");
  signupBtn.disabled = true;

  try {
    // Appeler le backend qui auto-confirme l'email (évite rate limit)
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${apiUrl}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Signup error:", error);
      showError("signupEmail", error.message || "Erreur lors de l'inscription");
      return;
    }

    const data = await response.json();
    console.log("✅ Inscription réussie:", data.user?.email);

    // Vérifier si vérification email requise
    if (data.emailVerificationRequired) {
      // Email de vérification envoyé
      loginFormContainer.classList.add("active");
      signupFormContainer.classList.remove("active");
      showAuthNotification('success', 'Compte créé ! Vérifiez votre email ' + data.user.email + ' pour activer votre compte.');
    } else if (data.token) {
      // Auto-confirm activé (dev) - se connecter directement
      const { error: signInError } = await supabase.auth.setSession({
        access_token: data.token,
        refresh_token: data.token,
      });

      if (signInError) {
        console.error("Session error:", signInError);
        loginFormContainer.classList.add("active");
        signupFormContainer.classList.remove("active");
        showAuthNotification('success', 'Compte créé ! Connectez-vous maintenant.');
      } else {
        window.location.href = "/";
      }
    } else {
      // Fallback
      loginFormContainer.classList.add("active");
      signupFormContainer.classList.remove("active");
      showAuthNotification('success', 'Compte créé ! Connectez-vous maintenant.');
    }
  } catch (error) {
    console.error("Signup error:", error);
    showError("signupEmail", "Erreur d'inscription. Veuillez réessayer.");
  } finally {
    signupBtn.classList.remove("loading");
    signupBtn.disabled = false;
  }
});

// ============================================
// REAL-TIME VALIDATION
// ============================================

// Email validation on blur
const emailInputs = ["loginEmail", "signupEmail"];
emailInputs.forEach((id) => {
  const input = document.getElementById(id) as HTMLInputElement;
  input?.addEventListener("blur", () => {
    if (input.value && !validateEmail(input.value)) {
      showError(id, "Format d'email invalide");
    } else if (input.value) {
      showSuccess(id);
    }
  });
});

// Password confirmation validation
const confirmPasswordInput = document.getElementById(
  "signupConfirmPassword"
) as HTMLInputElement;
confirmPasswordInput?.addEventListener("input", () => {
  const password = (
    document.getElementById("signupPassword") as HTMLInputElement
  ).value;
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword && password !== confirmPassword) {
    showError("signupConfirmPassword", "Les mots de passe ne correspondent pas");
  } else if (confirmPassword && password === confirmPassword) {
    showSuccess("signupConfirmPassword");
  } else {
    clearValidation("signupConfirmPassword");
  }
});
