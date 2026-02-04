# RelanceWork Landing Page

Landing page moderne et conversion-optimized pour RelanceWork.

## 🚀 Déploiement rapide

### Option 1 : Déployer sur Vercel (Recommandé)

1. Créez un compte sur [Vercel](https://vercel.com)
2. Installez Vercel CLI :
   ```bash
   npm install -g vercel
   ```
3. Déployez :
   ```bash
   cd landing-page
   vercel
   ```
4. Suivez les instructions et votre site sera en ligne en 2 minutes !

### Option 2 : Déployer sur Netlify

1. Créez un compte sur [Netlify](https://netlify.com)
2. Drag & drop le dossier `landing-page` dans Netlify
3. Votre site est en ligne !

Ou via CLI :
```bash
npm install -g netlify-cli
cd landing-page
netlify deploy --prod
```

### Option 3 : GitHub Pages

1. Poussez ce dossier dans un repo GitHub
2. Allez dans Settings → Pages
3. Sélectionnez la branche et le dossier `landing-page`
4. Votre site sera disponible sur `https://votre-username.github.io/repo-name/`

## 📁 Structure

```
landing-page/
├── index.html          # Page principale
├── css/
│   └── style.css       # Styles
├── js/
│   └── main.js         # JavaScript interactif
├── images/             # Vos images (ajoutez-les ici)
└── README.md          # Ce fichier
```

## 🎨 Personnalisation

### Changer les couleurs

Dans `css/style.css`, modifiez les variables CSS :

```css
:root {
    --primary: #6366f1;        /* Couleur principale */
    --primary-dark: #4f46e5;   /* Version foncée */
    --secondary: #0ea5e9;      /* Couleur secondaire */
}
```

### Ajouter votre logo

Remplacez l'emoji 🎯 dans `index.html` :

```html
<div class="logo-icon">
    <img src="images/logo.png" alt="RelanceWork" width="32">
</div>
```

### Modifier le contenu

Éditez directement `index.html` :
- **Hero** : Ligne 40-80
- **Features** : Ligne 120-200
- **Pricing** : Ligne 250-350
- **FAQ** : Ligne 400-450

## 📊 Intégrer le formulaire avec un backend

### Option 1 : Google Sheets (Gratuit)

1. Créez un Google Sheet
2. Utilisez [SheetDB](https://sheetdb.io/) ou [Sheety](https://sheety.co/)
3. Remplacez dans `js/main.js` ligne 50 :

```javascript
const response = await fetch('VOTRE_URL_SHEETDB', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});
```

### Option 2 : Airtable

1. Créez une base Airtable
2. Obtenez votre API key
3. Utilisez l'API Airtable :

```javascript
const response = await fetch('https://api.airtable.com/v0/YOUR_BASE/Waitlist', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        fields: formData
    })
});
```

### Option 3 : Intégrer avec votre backend RelanceWork

Modifiez `js/main.js` ligne 50 :

```javascript
const response = await fetch('http://localhost:3000/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});
```

## 📈 Analytics

### Google Analytics

Ajoutez avant `</head>` dans `index.html` :

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Plausible (Alternative privacy-friendly)

```html
<script defer data-domain="votredomaine.com" src="https://plausible.io/js/script.js"></script>
```

## 🎯 Optimisation SEO

### Meta tags essentiels (déjà inclus)

- ✅ Title
- ✅ Description
- ✅ Keywords

### À ajouter (recommandé)

```html
<!-- Open Graph (Facebook, LinkedIn) -->
<meta property="og:title" content="RelanceWork - Automatisez le suivi de vos candidatures">
<meta property="og:description" content="Ne ratez plus jamais une relance grâce à la détection automatique">
<meta property="og:image" content="https://votresite.com/images/og-image.jpg">
<meta property="og:url" content="https://votresite.com">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="RelanceWork">
<meta name="twitter:description" content="Automatisez le suivi de vos candidatures">
<meta name="twitter:image" content="https://votresite.com/images/twitter-image.jpg">

<!-- Favicon -->
<link rel="icon" type="image/png" href="images/favicon.png">
```

## 🖼️ Images recommandées

Ajoutez ces images dans le dossier `images/` :

- `logo.png` (512x512px) - Logo principal
- `og-image.jpg` (1200x630px) - Pour partage social
- `favicon.png` (32x32px) - Favicon
- `hero-mockup.png` (1200x800px) - Screenshot de l'app

## ✅ Checklist avant lancement

- [ ] Personnaliser les couleurs
- [ ] Ajouter votre logo
- [ ] Modifier le contenu (textes, stats)
- [ ] Connecter le formulaire à un backend
- [ ] Ajouter Google Analytics
- [ ] Tester sur mobile
- [ ] Vérifier tous les liens
- [ ] Ajouter les meta tags Open Graph
- [ ] Compresser les images
- [ ] Tester la vitesse (PageSpeed Insights)

## 🚀 Améliorations futures

- [ ] Ajouter une vidéo démo
- [ ] Créer un blog
- [ ] A/B testing des CTA
- [ ] Chatbot pour support
- [ ] Témoignages vidéo
- [ ] Section comparaison (vs Excel, etc.)
- [ ] Calculateur de ROI

## 📞 Support

Questions ? Contactez-moi ou consultez la doc.

## 📄 License

Propriétaire - RelanceWork 2026
