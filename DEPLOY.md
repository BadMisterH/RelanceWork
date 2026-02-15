# Guide de deploiement - RelanceWork

## Pre-requis

- Un compte GitHub (deja fait)
- Un compte Railway (https://railway.app) - connecte avec GitHub
- Le repo GitHub a jour (deja fait : `BadMisterH/RelanceWork`)

---

## Etape 1 : Creer le projet sur Railway

1. Va sur https://railway.app et connecte-toi avec ton compte GitHub
2. Clique sur **"New Project"** en haut a droite
3. Choisis **"Deploy from GitHub Repo"**
4. Selectionne le repo **RelanceWork**
5. Railway detecte automatiquement Node.js et lance un premier deploiement (il va echouer car il manque les variables d'environnement, c'est normal)

---

## Etape 2 : Ajouter un volume pour la base de donnees

Sans volume, tes donnees SQLite seront perdues a chaque redeploy.

1. Dans ton projet Railway, clique sur ton service **RelanceWork**
2. Va dans l'onglet **"Volumes"** (ou clique **+ New** > **Volume**)
3. Configure le volume :
   - **Mount Path** : `/data`
   - Confirme la creation
4. Le volume est maintenant attache a ton service

---

## Etape 3 : Configurer les variables d'environnement

Dans ton service Railway, va dans l'onglet **"Variables"** et ajoute chaque variable une par une :

### Variables de l'application

```
NODE_ENV=production
PORT=3000
DB_PATH=/data/relancework.sqlite
```

### URLs (tu mettras la vraie URL a l'etape 7)

```
FRONTEND_URL=https://PLACEHOLDER.up.railway.app/app
ALLOWED_ORIGINS=https://PLACEHOLDER.up.railway.app
```

### Supabase

Recupere ces valeurs depuis https://supabase.com/dashboard > ton projet > Settings > API

```
SUPABASE_URL=https://owiwkxcwutaprgndlkhp.supabase.co
SUPABASE_ANON_KEY=ta_anon_key
SUPABASE_SERVICE_KEY=ta_service_role_key
```

### Brevo (emails transactionnels)

```
BREVO_API_KEY=ta_cle_brevo
SENDER_EMAIL=badraitoufel5@gmail.com
```

### Stripe (paiements)

```
STRIPE_SECRET_KEY=sk_live_ta_cle_ou_sk_test_ta_cle
STRIPE_PUBLISHABLE_KEY=pk_live_ta_cle_ou_pk_test_ta_cle
STRIPE_WEBHOOK_SECRET=whsec_a_mettre_a_jour_etape_9
```

### Gmail OAuth

```
GMAIL_CLIENT_ID=ton_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=ton_client_secret
GMAIL_REDIRECT_URI=https://PLACEHOLDER.up.railway.app/api/gmail-user/callback
```

### Hunter.io

```
HUNTER_API_KEY=ta_cle_hunter
```

### Variables client (utilisees pendant le build Vite)

```
VITE_API_URL=/api
VITE_SUPABASE_URL=https://owiwkxcwutaprgndlkhp.supabase.co
VITE_SUPABASE_ANON_KEY=ta_anon_key_publique
VITE_GOOGLE_MAPS_API_KEY=ta_cle_google_maps
```

---

## Etape 4 : Verifier les commandes de build

Railway utilise automatiquement ces commandes (deja configurees dans `package.json`) :

- **Install** : `npm install`
- **Build** : `npm run build` (compile le backend TypeScript + le frontend Vite)
- **Start** : `npm start` (lance `node ./dist/server.js`)

Si Railway ne les detecte pas automatiquement, va dans **Settings** > **Build & Deploy** et configure :

| Champ | Valeur |
|-------|--------|
| Build Command | `npm run build` |
| Start Command | `npm start` |

---

## Etape 5 : Relancer le deploiement

1. Dans ton service Railway, va dans l'onglet **"Deployments"**
2. Clique sur **"Redeploy"** (ou pousse un commit sur GitHub, Railway redeploy automatiquement)
3. Surveille les logs du build :
   - Tu dois voir `tsc -p tsconfig.backend.json` reussir
   - Puis `cd client && npm install && npm run build` reussir
   - Puis `vite build` avec les fichiers `index.html` et `auth.html`
4. Attends que le deploiement passe au statut **"Active"**

Si le build echoue, lis les logs pour identifier l'erreur.

---

## Etape 6 : Generer un domaine public

1. Dans ton service, va dans l'onglet **"Settings"**
2. Section **"Networking"** > **"Public Networking"**
3. Clique sur **"Generate Domain"**
4. Railway te donne une URL du type : `relancework-production.up.railway.app`
5. **Note cette URL**, tu en auras besoin pour les etapes suivantes

---

## Etape 7 : Mettre a jour les variables avec la vraie URL

Maintenant que tu as ton URL Railway, retourne dans **Variables** et modifie :

```
FRONTEND_URL=https://relancework-production.up.railway.app/app
ALLOWED_ORIGINS=https://relancework-production.up.railway.app
GMAIL_REDIRECT_URI=https://relancework-production.up.railway.app/api/gmail-user/callback
```

Remplace `relancework-production.up.railway.app` par ton URL reelle.

Railway va automatiquement redeploy apres la modification des variables.

---

## Etape 8 : Configurer Supabase pour la production

Va sur https://supabase.com/dashboard > ton projet > **Authentication** > **URL Configuration**

1. **Site URL** : change en
   ```
   https://relancework-production.up.railway.app/app/auth.html
   ```

2. **Redirect URLs** : clique **Add URL** et ajoute
   ```
   https://relancework-production.up.railway.app/app/auth.html
   ```

3. Garde aussi l'URL localhost pour le dev local :
   ```
   http://localhost:5173/auth.html
   ```

---

## Etape 9 : Configurer le webhook Stripe en production

1. Va sur https://dashboard.stripe.com/webhooks
2. Clique **"Add endpoint"**
3. URL du endpoint :
   ```
   https://relancework-production.up.railway.app/api/billing/webhook
   ```
4. Selectionne les evenements a ecouter (au minimum) :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Apres la creation, copie le **Signing secret** (`whsec_...`)
6. Retourne dans Railway > Variables et mets a jour :
   ```
   STRIPE_WEBHOOK_SECRET=whsec_ton_nouveau_secret
   ```

---

## Etape 10 : Configurer Google OAuth en production

1. Va sur https://console.cloud.google.com > **APIs & Services** > **Credentials**
2. Clique sur ton **OAuth 2.0 Client ID**
3. Dans **Authorized redirect URIs**, ajoute :
   ```
   https://relancework-production.up.railway.app/api/gmail-user/callback
   ```
4. Dans **Authorized JavaScript origins**, ajoute :
   ```
   https://relancework-production.up.railway.app
   ```
5. Sauvegarde

---

## Etape 11 : Initialiser la base de donnees

La base SQLite doit etre initialisee avec les tables. Tu as deux options :

### Option A : Via Railway Shell (recommande)

1. Dans ton service Railway, va dans l'onglet **"Shell"** (ou utilise la CLI Railway)
2. Execute :
   ```bash
   node dist/scripts/createTable.js
   node dist/scripts/createFavoritesTable.js
   ```

### Option B : Via Railway CLI en local

1. Installe la CLI : `npm install -g @railway/cli`
2. Connecte-toi : `railway login`
3. Lie ton projet : `railway link`
4. Execute :
   ```bash
   railway run node dist/scripts/createTable.js
   railway run node dist/scripts/createFavoritesTable.js
   ```

---

## Etape 12 : Tester le deploiement

Ouvre ton navigateur et teste chaque partie :

| Test | URL | Resultat attendu |
|------|-----|-------------------|
| Health check | `https://ton-url.up.railway.app/health` | `{"status":"ok"}` |
| Landing page | `https://ton-url.up.railway.app/` | La page d'accueil publique |
| Application | `https://ton-url.up.railway.app/app/` | Le dashboard (redirige vers login) |
| Page auth | `https://ton-url.up.railway.app/app/auth.html` | Le formulaire de connexion |
| Inscription | Creer un compte | Email de verification recu via Brevo |
| Connexion | Se connecter | Acces au dashboard |
| Reset password | Mot de passe oublie | Email de reset recu via Brevo |

---

## Etape 13 : Restreindre Google Maps API Key

1. Va sur https://console.cloud.google.com > **APIs & Services** > **Credentials**
2. Clique sur ta cle API Google Maps
3. Dans **Application restrictions**, choisis **HTTP referrers**
4. Ajoute :
   ```
   https://relancework-production.up.railway.app/*
   http://localhost:5173/*
   ```

---

## Resume de l'architecture en production

```
Railway (relancework-production.up.railway.app)
|
|-- /                  Landing page (public/)
|-- /app/              Application SPA (client/dist/)
|-- /app/auth.html     Login / Signup / Reset password
|-- /api/              API REST Express
|-- /health            Health check
|
|-- /data/             Volume persistant (SQLite)
|
Services externes :
|-- Supabase           Auth + base utilisateurs
|-- Brevo              Emails transactionnels
|-- Stripe             Paiements / abonnements
|-- Google APIs        Maps + Gmail OAuth
|-- Hunter.io          Enrichissement email
```

---

## En cas de probleme

### Le build echoue
- Verifie les logs dans Railway > Deployments > clique sur le deploy en erreur
- Les erreurs TypeScript apparaissent en clair dans les logs

### L'app demarre mais plante
- Verifie les logs dans Railway > Logs
- Assure-toi que toutes les variables d'environnement sont definies
- Verifie que le volume est bien monte sur `/data`

### Les emails ne partent pas
- Verifie `BREVO_API_KEY` et `SENDER_EMAIL` dans les variables
- Verifie que l'IP de Railway est autorisee dans Brevo (Security > IP check desactive)

### La connexion/inscription ne marche pas
- Verifie les URLs dans Supabase > Authentication > URL Configuration
- Verifie que `SUPABASE_URL` et `SUPABASE_SERVICE_KEY` sont corrects

### CORS errors dans la console
- Verifie que `ALLOWED_ORIGINS` contient bien ton URL Railway (sans slash final)
