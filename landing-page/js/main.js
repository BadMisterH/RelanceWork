// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });
}

// Smooth Scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = target.offsetTop - headerHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// FAQ Accordion
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
        // Close all other items
        faqItems.forEach(otherItem => {
            if (otherItem !== item) {
                otherItem.classList.remove('active');
            }
        });
        // Toggle current item
        item.classList.toggle('active');
    });
});

// Waitlist Form Submission
const waitlistForm = document.getElementById('waitlist-form');
const formSuccess = document.getElementById('form-success');

if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            profile: document.getElementById('profile').value,
            timestamp: new Date().toISOString()
        };

        // Here you would normally send this to your backend
        // For demo purposes, we'll just simulate a successful submission
        console.log('Form submitted:', formData);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Show success message
        waitlistForm.style.display = 'none';
        formSuccess.style.display = 'block';

        // Optional: Send to Google Sheets, Airtable, or your backend
        // Example with fetch:
        /*
        try {
            const response = await fetch('YOUR_API_ENDPOINT', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                waitlistForm.style.display = 'none';
                formSuccess.style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Une erreur est survenue. Veuillez réessayer.');
        }
        */

        // Track conversion with analytics (optional)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion', {
                'send_to': 'YOUR_CONVERSION_ID'
            });
        }
    });
}

// Scroll animations (intersection observer)
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});

// Header scroll effect
let lastScroll = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// Update stats counter animation (optional enhancement)
const animateCounter = (element, target, duration = 2000) => {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
};

// Animate counters when they come into view
const statNumbers = document.querySelectorAll('.stat-number');
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
            const target = entry.target.textContent;
            if (!isNaN(target)) {
                animateCounter(entry.target, parseInt(target));
            }
            entry.target.classList.add('animated');
        }
    });
}, { threshold: 0.5 });

statNumbers.forEach(stat => {
    if (!isNaN(stat.textContent)) {
        stat.textContent = '0';
        statsObserver.observe(stat);
    }
});

// Update early access count (simulate real-time)
const earlyAccessCount = document.querySelector('.early-access-count strong');
if (earlyAccessCount) {
    setInterval(() => {
        const currentCount = parseInt(earlyAccessCount.textContent);
        if (Math.random() > 0.7) { // 30% chance every 10 seconds
            earlyAccessCount.textContent = currentCount + 1;
        }
    }, 10000);
}

// Pricing card hover effect enhancement
const pricingCards = document.querySelectorAll('.pricing-card');
pricingCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px) scale(1.02)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// Log page views (replace with your analytics)
console.log('Page loaded at:', new Date().toISOString());

// Track CTA clicks (optional)
document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', () => {
        console.log('CTA clicked:', btn.textContent);
        // Add your analytics tracking here
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                'event_category': 'CTA',
                'event_label': btn.textContent
            });
        }
    });
});
