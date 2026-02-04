import "./styles/auth.css";

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
// FORM VALIDATION
// ============================================

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
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
    // TODO: Replace with actual API call
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (response.ok) {
      const data = await response.json();
      // Store token
      if (rememberMe) {
        localStorage.setItem("authToken", data.token);
      } else {
        sessionStorage.setItem("authToken", data.token);
      }
      // Redirect to dashboard
      window.location.href = "/";
    } else {
      const error = await response.json();
      showError("loginPassword", error.message || "Email ou mot de passe incorrect");
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
    showError("signupEmail", "Format d'email invalide");
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
    alert("Veuillez accepter les conditions d'utilisation");
    isValid = false;
  }

  if (!isValid) return;

  // Show loading state
  signupBtn.classList.add("loading");
  signupBtn.disabled = true;

  try {
    // TODO: Replace with actual API call
    const response = await fetch("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      // Store token
      sessionStorage.setItem("authToken", data.token);
      // Redirect to dashboard
      window.location.href = "/";
    } else {
      const error = await response.json();
      showError("signupEmail", error.message || "Erreur lors de l'inscription");
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
