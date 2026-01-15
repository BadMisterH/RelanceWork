# RelanceWork

> 📋 Application de suivi de candidatures pour gérer vos recherches d'emploi

---

## 📋 Description

**RelanceWork** est une application web full-stack qui permet de suivre et gérer ses candidatures professionnelles. Elle offre une API REST complète pour créer, consulter et supprimer des candidatures, avec une persistance des données via PostgreSQL et une interface utilisateur moderne en HTML/TypeScript.

### ✨ Fonctionnalités actuelles

- ✅ **Créer** une candidature (entreprise, poste, statut, date)
- ✅ **Consulter** toutes les candidatures enregistrées
- ✅ **Supprimer** une candidature par son ID
- ✅ **Persister** les données dans une base PostgreSQL
- ✅ **Interface web** pour gérer les candidatures

---

## 🛠️ Stack Technique

### Backend
- ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white) **Node.js** + **TypeScript**
- ![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white) **Express.js** - Framework web
- ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white) **PostgreSQL** - Base de données relationnelle

### Frontend
- ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) **TypeScript**
- ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) **HTML5**
- ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white) **CSS3**

### Architecture
- **MVC** - Séparation Controllers / Routes / Models / Views
- **REST API** - Architecture RESTful
- **OOP** - Programmation orientée objet (classe UI)
- **Sécurité** - Requêtes SQL paramétrées

---

## 🚀 Installation

### Prérequis
- Node.js (v16+)
- PostgreSQL (v12+)
- npm ou yarn

### Étapes d'installation

#### 1️⃣ Cloner le projet
```bash
git clone <url-du-repo>
cd RelanceWork
```

#### 2️⃣ Installer les dépendances
```bash
npm install
```

#### 3️⃣ Configurer PostgreSQL
- Installer et démarrer PostgreSQL (ex: avec DBngin)
- Le serveur doit tourner sur le port `5433`
- Créer la base de données :

```bash
psql -U postgres -h localhost -p 5433
CREATE DATABASE relancework;
\q
```

#### 4️⃣ Créer la table
```bash
npm run create-table
```

#### 5️⃣ Lancer l'application
```bash
# Mode développement (backend + frontend avec auto-reload)
npm run dev

# Dans un autre terminal : compiler le frontend en mode watch
npm run dev:frontend

# Mode production
npm run build
npm start
```

🌐 **Application disponible sur** : [http://localhost:3000](http://localhost:3000)

---

## 📡 API REST

### 🏥 Health Check
```http
GET /health
```
**Réponse :**
```json
{ "status": "ok" }
```

### 📋 Récupérer toutes les candidatures
```http
GET /api/applications
```
**Réponse :**
```json
[
  {
    "id": 1,
    "company": "Google",
    "poste": "Développeur Full Stack",
    "status": "Candidature envoyée",
    "date": "2026-01-10",
    "created_at": "2026-01-10T12:00:00.000Z"
  }
]
```

### ➕ Créer une candidature
```http
POST /api/application
Content-Type: application/json
```
**Body :**
```json
{
  "company": "Apple",
  "poste": "Développeur iOS",
  "status": "En attente",
  "date": "2026-01-10"
}
```
**Réponse :**
```json
{
  "message": "Application created",
  "data": {
    "id": 2,
    "company": "Apple",
    "poste": "Développeur iOS",
    "status": "En attente",
    "date": "2026-01-10"
  }
}
```

### 🗑️ Supprimer une candidature
```http
DELETE /api/applications/:id
```
**Réponse (succès) :**
```json
{
  "message": "Supprimé",
  "deleted": { ... }
}
```

**Réponse (404) :**
```json
{
  "message": "Aucune candidature trouvée"
}
```

---

## 📁 Structure du Projet

```
RelanceWork/
├── 📂 src/                      # Code source backend
│   ├── 📂 controllers/          # Logique métier
│   │   └── applicationController.ts
│   ├── 📂 routes/               # Définition des routes
│   │   └── applicationRoutes.ts
│   ├── 📂 config/               # Configuration
│   │   └── database.ts
│   ├── 📂 types/                # Types TypeScript
│   │   └── Application.ts
│   ├── 📂 scripts/              # Scripts utilitaires
│   │   └── createTable.ts
│   ├── app.ts                   # Configuration Express
│   └── server.ts                # Point d'entrée
│
├── 📂 frontend/                 # Code source frontend (TypeScript)
│   ├── 📂 class/
│   │   └── UI.ts                # Classe UI (OOP)
│   └── app.ts                   # Logique principale
│
├── 📂 public/                   # Fichiers statiques (servis au navigateur)
│   ├── 📂 css/
│   │   └── style.css
│   ├── 📂 js/                   # JavaScript compilé
│   │   └── app.js
│   └── index.html               # Page principale
│
├── 📂 dist/                     # Backend compilé (généré)
├── 📄 package.json
├── 📄 tsconfig.json             # Config TypeScript backend
├── 📄 tsconfig.frontend.json    # Config TypeScript frontend
├── 📄 CLAUDE.md                 # Documentation pour Claude
└── 📄 README.md                 # Ce fichier
```

---

## 🎯 Scripts NPM

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur backend en mode développement (auto-reload) |
| `npm run dev:frontend` | Compile le frontend TypeScript en mode watch |
| `npm run build` | Compile backend + frontend pour production |
| `npm run build:backend` | Compile uniquement le backend |
| `npm run build:frontend` | Compile uniquement le frontend |
| `npm start` | Lance le serveur en mode production |
| `npm run create-table` | Crée la table PostgreSQL |

---

## 🔧 Configuration

### Variables d'environnement (optionnel)

Créez un fichier `.env` à la racine :

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=relancework
DB_USER=postgres
DB_PASSWORD=
```

**Valeurs par défaut :**
- Host : `localhost`
- Port : `5433`
- Database : `relancework`
- User : `postgres`
- Password : `` (vide)

---

## 🚧 Roadmap

### 📅 Court terme
- [ ] **Formulaire fonctionnel** - Soumission POST depuis l'interface
- [ ] **Bouton supprimer** - DELETE depuis l'interface
- [ ] **Validation des données** - Valider les inputs (Zod)
- [ ] **CSS/Design** - Améliorer l'apparence
- [ ] **Tests** - Tests unitaires et d'intégration

### 📅 Moyen terme
- [ ] **Authentification** - Système de login/register
- [ ] **Mise à jour** - Endpoint PUT + formulaire édition
- [ ] **Filtres et tri** - Filtrer par statut, trier par date
- [ ] **Pagination** - Gérer de grandes listes
- [ ] **Variables d'environnement** - dotenv

### 📅 Long terme
- [ ] **🔄 Synchronisation multi-plateformes**
  - [ ] Gmail API - Détection automatique des emails de candidature
  - [ ] LinkedIn API - Suivi des candidatures LinkedIn
  - [ ] Indeed - Extension navigateur pour tracking
- [ ] **🔔 Notifications** - Rappels pour relancer les entreprises
- [ ] **📊 Statistiques** - Dashboard avec graphiques
- [ ] **📤 Export** - CSV/PDF
- [ ] **👥 Multi-utilisateurs** - Gestion de plusieurs comptes
- [ ] **📚 API Documentation** - Swagger/OpenAPI
- [ ] **🐳 Containerisation** - Docker + Docker Compose
- [ ] **🚀 CI/CD** - Pipeline de déploiement

---

## 🔒 Sécurité

| Fonctionnalité | Statut | Note |
|----------------|--------|------|
| Requêtes SQL paramétrées | ✅ | Protection injection SQL |
| Authentification | ⚠️ | À implémenter |
| Validation des inputs | ⚠️ | À implémenter |
| Rate limiting | ⚠️ | À implémenter |
| HTTPS | ⚠️ | À configurer en production |

---

## 📝 License

MIT © Badro

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

## 📧 Contact

**Badro** - Développeur Full Stack

---

<p align="center">
  Fait avec ❤️ et TypeScript
</p>
