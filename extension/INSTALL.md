# 🚀 Installation Rapide - Extension RelanceWork

## Étape 1 : Créer l'icône

1. Ouvrez le fichier `create-icon.html` dans Chrome
2. L'icône `icon.png` se téléchargera automatiquement
3. Déplacez `icon.png` dans le dossier `extension/`

**Alternative :** Utilisez n'importe quelle image PNG de 128x128 pixels et renommez-la `icon.png`

## Étape 2 : Installer l'extension

1. Ouvrez Chrome
2. Allez à : **chrome://extensions/**
3. Activez le **Mode développeur** (toggle en haut à droite)
4. Cliquez sur **Charger l'extension non empaquetée**
5. Sélectionnez le dossier `extension/`
6. ✅ L'extension est installée !

## Étape 3 : Démarrer l'API

Dans le terminal, depuis la racine du projet :

```bash
npm run dev
```

L'API doit tourner sur `http://localhost:3000`

## Étape 4 : Tester

1. Allez sur Gmail
2. Composez un nouvel email
3. Dans l'objet, écrivez : `[CANDIDATURE] Test - Développeur`
4. Envoyez l'email
5. Une notification verte devrait apparaître ! 🎉

## Vérification

- Cliquez sur l'icône de l'extension (puzzle 🧩 en haut à droite de Chrome)
- Vous devriez voir : **✅ Extension active**

## Format d'objet

```
[CANDIDATURE] Entreprise - Poste
[RELANCE] Entreprise - Poste
```

**Exemples valides :**
- `[CANDIDATURE] Google - Backend Developer`
- `[RELANCE] Microsoft - DevOps`
- `[CANDIDATURE] Apple - iOS Engineer`

## Problèmes courants

### "API non disponible"
→ Lancez `npm run dev` dans le projet RelanceWork

### L'email n'est pas détecté
→ Vérifiez le format de l'objet (doit commencer par `[CANDIDATURE]` ou `[RELANCE]`)

### Rien ne se passe
→ Ouvrez la console (F12) et regardez les messages de l'extension

---

**Besoin d'aide ?** Consultez le [README.md](README.md) complet.
