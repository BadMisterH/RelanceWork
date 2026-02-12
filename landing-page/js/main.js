// ============================================
// Theme Toggle
// ============================================
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

// ============================================
// Mobile Menu
// ============================================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

if (mobileMenuBtn && navLinks) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenuBtn.classList.remove('active');
      navLinks.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// ============================================
// Smooth Scrolling
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      const headerHeight = document.querySelector('.header').offsetHeight;
      window.scrollTo({
        top: target.offsetTop - headerHeight - 16,
        behavior: 'smooth'
      });
    }
  });
});

// ============================================
// Header scroll effect
// ============================================
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ============================================
// FAQ Accordion
// ============================================
document.querySelectorAll('.faq-item').forEach(item => {
  const question = item.querySelector('.faq-question');
  if (!question) return;

  question.addEventListener('click', () => {
    document.querySelectorAll('.faq-item').forEach(other => {
      if (other !== item) other.classList.remove('active');
    });
    item.classList.toggle('active');
  });
});

// ============================================
// Scroll-triggered animations
// ============================================
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px'
});

document.querySelectorAll('[data-anim]').forEach(el => {
  animObserver.observe(el);
});

// ============================================
// Waitlist Form
// ============================================
const waitlistForm = document.getElementById('waitlist-form');
const formSuccess = document.getElementById('form-success');

if (waitlistForm && formSuccess) {
  waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = waitlistForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="animation: spin 1s linear infinite"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-linecap="round"/></svg> Envoi...';

    const formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      profile: document.getElementById('profile').value,
      timestamp: new Date().toISOString()
    };

    // Simulate API call (replace with real endpoint)
    await new Promise(resolve => setTimeout(resolve, 1200));
    console.log('Waitlist submission:', formData);

    waitlistForm.style.display = 'none';
    formSuccess.style.display = 'block';

    // Track conversion
    if (typeof gtag !== 'undefined') {
      gtag('event', 'conversion', {
        'event_category': 'waitlist',
        'event_label': formData.profile
      });
    }
  });
}

// Add spin keyframes dynamically
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
