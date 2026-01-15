# 📋 RelanceWork - Extension Chrome

Extension Chrome qui détecte automatiquement vos emails de candidature envoyés via Gmail et les ajoute à votre application RelanceWork.

## 🎯 Fonctionnalités

- ✅ Détection automatique des emails de candidature
- ✅ Parsing intelligent de l'objet de l'email
- ✅ Ajout automatique à votre base de données RelanceWork
- ✅ Notifications visuelles dans Gmail
- ✅ Support des candidatures et relances

## 📦 Installation

### 1. Générer l'icône

Ouvrez le fichier `create-icon.html` dans votre navigateur pour générer l'icône PNG. Le fichier se téléchargera automatiquement. Déplacez `icon.png` dans le dossier `extension/`.

Ou créez simplement une image PNG 128x128 nommée `icon.png`.

### 2. Charger l'extension dans Chrome

1. Ouvrez Chrome et allez à : `chrome://extensions/`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `extension/`
5. L'extension est maintenant installée ! 🎉

### 3. Démarrer RelanceWork API

Assurez-vous que votre serveur RelanceWork tourne :

```bash
npm run dev
```

L'API doit être accessible sur `http://localhost:3000`

## 📝 Utilisation

### Format d'objet requis

Pour que l'extension détecte vos candidatures, utilisez ce format dans l'objet de vos emails :

**Pour une candidature :**
```
[CANDIDATURE] Nom de l'entreprise - Intitulé du poste
```

**Pour une relance :**
```
[RELANCE] Nom de l'entreprise - Intitulé du poste
```

### Exemples

```
[CANDIDATURE] Google - Développeur Backend
[CANDIDATURE] Microsoft - DevOps Engineer
[RELANCE] Amazon - Software Engineer
[CANDIDATURE] Apple - iOS Developer
```

### Workflow

1. **Composez votre email de candidature dans Gmail**
2. **Utilisez le format ci-dessus dans l'objet**
   - Exemple : `[CANDIDATURE] Airbnb - Full Stack Developer`
3. **Envoyez l'email** 📧
4. **L'extension détecte l'envoi automatiquement**
5. **Une notification apparaît** confirmant l'ajout
6. **Votre candidature est ajoutée à RelanceWork** ✅

## 🔧 Configuration

### Changer l'URL de l'API

Si votre API n'est pas sur `localhost:3000`, modifiez l'URL dans `content.js` :

```javascript
const API_URL = 'http://localhost:3000/api'; // Changez ici
```

## 🐛 Dépannage

### L'extension ne détecte pas mes emails

1. **Vérifiez le format de l'objet**
   - Il doit commencer par `[CANDIDATURE]` ou `[RELANCE]`
   - Format : `[TYPE] Entreprise - Poste`

2. **Vérifiez que l'API est démarrée**
   - L'API doit être accessible sur `http://localhost:3000`
   - Testez : `http://localhost:3000/health`

3. **Ouvrez la console du navigateur**
   - F12 → Console
   - Recherchez les messages de RelanceWork
   - Les erreurs s'afficheront ici

### L'API ne reçoit pas les données

1. **Vérifiez les CORS**
   - Votre API doit accepter les requêtes depuis Gmail
   - Le fichier `app.ts` contient déjà la config CORS

2. **Vérifiez les logs de l'API**
   - Regardez le terminal où `npm run dev` tourne
   - Les requêtes POST doivent apparaître

### Notifications n'apparaissent pas

1. **Rechargez l'extension**
   - Allez dans `chrome://extensions/`
   - Cliquez sur le bouton de rechargement ↻

2. **Rechargez Gmail**
   - Actualisez la page Gmail (F5)

## 📊 Données envoyées à l'API

L'extension envoie un objet JSON vers `POST /api/application` :

```json
{
  "company": "Google",
  "poste": "Développeur Backend",
  "status": "Candidature envoyée"
}
```

Pour une relance, le statut sera `"Relance envoyée"`.

La date est ajoutée automatiquement par l'API.

## 🔒 Permissions

L'extension demande les permissions suivantes :

- **`https://mail.google.com/*`** : Pour détecter les emails dans Gmail
- **`http://localhost:3000/*`** : Pour communiquer avec votre API locale
- **`storage`** : Pour stocker les préférences (futur)

## 🚀 Améliorations futures

- [ ] Support d'Outlook
- [ ] Configuration de l'URL API depuis le popup
- [ ] Statistiques des candidatures détectées
- [ ] Détection automatique de réponses reçues
- [ ] Support de formats d'objet personnalisés

## 📄 Licence

Ce projet fait partie de RelanceWork.

## 🤝 Support

En cas de problème :
1. Vérifiez les logs dans la console (F12)
2. Vérifiez que votre API tourne
3. Testez le format d'objet manuellement

---

**Astuce** : Cliquez sur l'icône de l'extension dans Chrome pour voir le statut et des exemples d'utilisation !
