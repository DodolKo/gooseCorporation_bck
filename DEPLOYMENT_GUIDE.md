# 🚀 Guide de Déploiement Railway - GooseCorp Backend

## 📋 Prérequis

### 1. Installation Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Connexion Railway
```bash
railway login
```

### 3. Initialisation du projet Railway
```bash
railway init
```

## 🔐 Configuration des Variables d'Environnement

### Variables CRITIQUES à configurer dans Railway :

1. **DATABASE_URL** - URL de votre base PostgreSQL Railway
2. **JWT_SECRET** - Secret pour les tokens JWT
3. **SESSION_SECRET** - Secret pour les sessions
4. **ALLOWED_ORIGINS** - Domaines autorisés pour CORS

### Configuration via Railway CLI :
```bash
# Configurer les variables d'environnement
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="votre-jwt-secret-securise"
railway variables set SESSION_SECRET="votre-session-secret-securise"
railway variables set DATABASE_URL="postgresql://user:pass@host:port/db"
railway variables set ALLOWED_ORIGINS="https://votre-frontend.com,https://votre-app.railway.app"
```

### Configuration via Dashboard Railway :
1. Allez sur https://railway.app/dashboard
2. Sélectionnez votre projet
3. Onglet "Variables"
4. Ajoutez chaque variable

## 🗄️ Configuration Base de Données

### 1. Créer une base PostgreSQL sur Railway
```bash
# Dans le dashboard Railway
# 1. "New Service" → "Database" → "PostgreSQL"
# 2. Notez l'URL de connexion
```

### 2. Appliquer les migrations
```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# (Optionnel) Seeder la base
npx prisma db seed
```

## 🚀 Déploiement

### Méthode 1 : Script automatique (RECOMMANDÉ)
```bash
# Vérifier que vous êtes sur la branche prod
git checkout prod

# Lancer le déploiement
npm run deploy
```

### Méthode 2 : Manuel
```bash
# Déployer
railway up

# Vérifier le statut
railway status

# Voir les logs
railway logs
```

## ✅ Vérifications Post-Déploiement

### 1. Health Check
```bash
curl https://votre-app.railway.app/health
```

### 2. Test de l'API
```bash
# Test de connexion admin
curl -X POST https://votre-app.railway.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@goosecorp.com","password":"Admin123!"}'
```

### 3. Vérifier les logs
```bash
railway logs
```

## 🔧 Configuration CORS

### Pour le développement :
```bash
railway variables set ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173"
```

### Pour la production :
```bash
railway variables set ALLOWED_ORIGINS="https://votre-frontend.com,https://votre-app.railway.app"
```

## 📊 Monitoring

### Logs en temps réel :
```bash
railway logs --follow
```

### Métriques :
- Dashboard Railway : https://railway.app/dashboard
- Health check : `https://votre-app.railway.app/health`

## 🛠️ Dépannage

### Problème : App ne démarre pas
```bash
# Vérifier les logs
railway logs

# Vérifier les variables d'environnement
railway variables

# Redémarrer le service
railway service restart
```

### Problème : Erreur de base de données
```bash
# Vérifier la connexion DB
railway variables get DATABASE_URL

# Appliquer les migrations
npx prisma migrate deploy
```

### Problème : CORS
```bash
# Vérifier ALLOWED_ORIGINS
railway variables get ALLOWED_ORIGINS

# Mettre à jour si nécessaire
railway variables set ALLOWED_ORIGINS="nouveaux-domaines"
```

## 🔄 Mise à Jour

### 1. Mettre à jour le code
```bash
git add .
git commit -m "Update for production"
git push origin prod
```

### 2. Redéployer
```bash
npm run deploy
```

## 📝 Notes Importantes

### Sécurité :
- ✅ Ne jamais commiter les fichiers `.env`
- ✅ Utiliser des secrets forts pour JWT et SESSION
- ✅ Configurer CORS strictement
- ✅ Activer HTTPS (automatique sur Railway)

### Performance :
- ✅ Rate limiting configuré pour la production
- ✅ Health checks automatiques
- ✅ Restart automatique en cas d'échec

### Monitoring :
- ✅ Logs d'audit activés
- ✅ Métriques de santé
- ✅ Alertes automatiques Railway

## 🆘 Support

### Commandes utiles :
```bash
# Statut du service
railway status

# Variables d'environnement
railway variables

# Logs
railway logs

# Redémarrer
railway service restart

# Ouvrir le dashboard
railway open
```

### Documentation Railway :
- https://docs.railway.app/
- https://railway.app/dashboard 