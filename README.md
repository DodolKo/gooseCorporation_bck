# 🏢 GooseCorp Backend - Système de Gestion des Visiteurs

## 📋 Vue d'ensemble

GooseCorp Backend est une API REST sécurisée pour la gestion des visiteurs, du personnel et des formations dans un bâtiment d'entreprise. Le système comprend un CMS d'administration complet avec authentification JWT et une API publique pour le frontend.

## 🏗️ Architecture

### Technologies Utilisées

- **Runtime**: Node.js (v23.9.0)
- **Framework**: Express.js 5.1.0
- **Base de données**: PostgreSQL 15
- **ORM**: Prisma 6.11.1
- **Authentification**: JWT + bcryptjs
- **Sécurité**: Helmet, CORS, CSRF, Rate Limiting
- **Templating**: EJS
- **Containerisation**: Docker & Docker Compose
- **Déploiement**: Railway

### Structure du Projet

```
gooseCorp_bck/
├── src/
│   ├── config/
│   │   └── database.js          # Configuration Prisma
│   ├── routes/
│   │   ├── adminApi.js          # API REST pour l'admin
│   │   ├── adminWeb.js          # Interface web d'administration
│   │   ├── visitors.js          # API pour les visiteurs
│   │   └── badges.js            # API pour les badges
│   ├── utils/
│   │   └── seed.js              # Peuplement initial de la BDD
│   ├── views/
│   │   └── admin/               # Templates EJS pour le CMS
│   ├── public/                  # Fichiers statiques
│   ├── generated/
│   │   └── prisma/              # Client Prisma généré
│   ├── app.js                   # Configuration Express
│   └── server.js                # Point d'entrée
├── prisma/
│   └── schema.prisma            # Schéma de base de données
├── docker-compose.yml           # Services Docker
├── railway.toml                 # Configuration Railway
├── .env                         # Variables d'environnement
└── package.json
```

## 🗄️ Modèle de Données

### Entités Principales

- **AdminUser**: Utilisateurs administrateurs du système
- **GooseCorpUser**: Visiteurs enregistrés avec statut (INSIDE/OUTSIDE)
- **GooseCorpStaff**: Personnel de l'entreprise
- **GooseCorpFormation**: Formations/événements
- **Visit**: Historique des entrées/sorties avec actions (CHECK_IN/CHECK_OUT/RETURN)
- **Badge**: Badges d'accès temporaires avec expiration
- **Log**: Journalisation des actions administratives

### Fonctionnalités Principales

- ✅ **Enregistrement de visiteurs** avec QR code généré
- ✅ **Gestion des badges temporaires** avec expiration automatique
- ✅ **Suivi des statuts** (à l'intérieur/à l'extérieur du bâtiment)
- ✅ **Historique complet** des entrées et sorties
- ✅ **Re-entrées** pour visiteurs avec badges existants
- ✅ **Vérification automatique** des statuts avant actions
- ✅ **API publique** pour les données frontend
- ✅ **Interface d'administration** complète avec authentification

### Relations

```mermaid
erDiagram
    AdminUser ||--o{ Log : "crée"
    GooseCorpStaff ||--o{ GooseCorpUser : "reçoit"
    GooseCorpFormation ||--o{ GooseCorpUser : "accueille"
    GooseCorpUser ||--o{ Visit : "effectue"
    GooseCorpUser ||--o| Badge : "possède"
```

## 🚀 Installation et Configuration

### Prérequis

- Node.js >= 18.x
- Docker et Docker Compose
- Git

### Installation

1. **Cloner le repository**
```bash
git clone <repository-url>
cd gooseCorp_bck
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l'environnement**
```bash
# Le fichier .env est déjà configuré avec :
DATABASE_URL="postgresql://AdminDodol:12345@localhost:5432/gooseCorp_db"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
SESSION_SECRET="your-super-secret-session-key-change-this-in-production"
NODE_ENV=development
PORT=3000
```

4. **Démarrer les services Docker**
```bash
docker-compose up -d
```

5. **Générer le client Prisma**
```bash
npx prisma generate
```

6. **Peupler la base de données**
```bash
npm run seed
```

7. **Démarrer le serveur**
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 🔧 Scripts de Maintenance

### Nettoyage des Doublons

Si vous avez des doublons dans la base de données :

```bash
node fix-seed-duplicates.js
```

Ce script :
- ✅ Analyse l'état actuel de la base
- 🧹 Supprime les visiteurs en double (garde le premier par email)
- 🔧 Corrige le script seed.js pour éviter les futurs doublons
- 📊 Affiche les statistiques avant/après

### Re-seeding

```bash
npm run seed
```

## 🔐 Authentification et Sécurité

### Credentials par Défaut

**Administrateur Principal**
- Email: `admin@goosecorp.com`
- Mot de passe: `Admin123!`

**Gestionnaire**
- Email: `manager@goosecorp.com`
- Mot de passe: `Manager123!`

### Sécurité Implémentée

- **JWT**: Tokens d'authentification avec expiration 24h
- **bcrypt**: Hashage des mots de passe (12 rounds)
- **CSRF**: Protection contre les attaques Cross-Site Request Forgery
- **Rate Limiting**: Limitation des requêtes (100/15min, 5 tentatives login/15min)
- **CORS**: Configuration stricte des origines autorisées
- **Helmet**: Headers de sécurité HTTP
- **Validation**: Validation des entrées avec express-validator

## 🌐 API Endpoints

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/admin/login` | Connexion API (retourne JWT) |
| POST | `/admin/login-web` | Connexion web (cookie de session) |
| GET | `/admin/logout` | Déconnexion |

### Administration (Protected)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/dashboard` | Tableau de bord principal |
| GET | `/admin/visitors` | Gestion des visiteurs |
| GET | `/admin/staff` | Gestion du personnel |
| GET | `/admin/formations` | Gestion des formations |
| GET | `/admin/history` | Historique des visites |

### API REST (Protected)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/dashboard` | Données du tableau de bord |
| GET | `/api/admin/visitors` | Liste des visiteurs |
| POST | `/api/admin/visitors` | Créer un visiteur |
| PUT | `/api/admin/visitors/:id` | Modifier un visiteur |
| DELETE | `/api/admin/visitors/:id` | Supprimer un visiteur |
| GET | `/api/admin/staff` | Gestion du personnel |
| POST | `/api/admin/staff` | Créer un membre du personnel |
| PUT | `/api/admin/staff/:id` | Modifier un membre du personnel |
| DELETE | `/api/admin/staff/:id` | Supprimer un membre du personnel |
| GET | `/api/admin/formations` | Gestion des formations |
| POST | `/api/admin/formations` | Créer une formation |
| PUT | `/api/admin/formations/:id` | Modifier une formation |
| DELETE | `/api/admin/formations/:id` | Supprimer une formation |
| GET | `/api/admin/logs` | Journaux d'activité |
| GET | `/api/admin/history` | Historique des visites |

### API Visiteurs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/visitors` | Enregistrement nouveau visiteur |
| GET | `/api/visitors/:identifier/status` | Vérification du statut visiteur |
| POST | `/api/visitors/:identifier/checkout` | Sortie visiteur |
| POST | `/api/visitors/:identifier/reentry` | Re-entrée visiteur existant |
| GET | `/api/visitors/status/inside` | Visiteurs actuellement présents |
| GET | `/api/visitors/search/email/:email` | Recherche visiteur par email |
| PUT | `/api/visitors/:identifier` | Modifier un visiteur |
| DELETE | `/api/visitors/:identifier` | Supprimer un visiteur |

### API Publique (Frontend)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/visitors/public/staff` | Liste du personnel actif |
| GET | `/api/visitors/public/formations` | Liste des formations actives |
| GET | `/api/visitors/public/health` | Vérification de santé API |

### API Badges

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/badges/generate/:visitorId` | Génération badge temporaire |
| GET | `/api/badges/verify/:badgeId` | Vérification badge |
| GET | `/api/badges` | Liste tous les badges |
| PATCH | `/api/badges/deactivate/:badgeId` | Désactiver un badge |

### Système

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Vérification de santé générale |
| GET | `/api/visitors/test` | Test des routes visiteurs |

## 🔍 Monitoring et Logs

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs d'Audit

Toutes les actions sont loggées :
- Connexions/déconnexions
- Actions CRUD sur les entités
- Accès aux pages protégées

### Métriques Disponibles

- Nombre total de visiteurs
- Visiteurs actuellement présents
- Statistiques journalières
- État des badges actifs
- Personnel actif/inactif

## 📊 Base de Données

### Accès PostgreSQL

```bash
# Via Docker
docker exec -it gooseCorp-postgres psql -U AdminDodol -d gooseCorp_db

# Via pgAdmin (interface web)
http://localhost:8080
Login: admin@goosecorp.com
Password: admin123
```

### Migrations Prisma

```bash
# Générer une migration
npx prisma migrate dev --name description_migration

# Appliquer les migrations
npx prisma migrate deploy

# Réinitialiser la base
npx prisma migrate reset
```

## 🚦 Tests et Validation

### Tests de l'API

```bash
# Test de santé
curl http://localhost:3000/health

# Test de connexion
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@goosecorp.com","password":"Admin123!"}' \
  http://localhost:3000/api/admin/login

# Test avec token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/admin/dashboard

# Test création visiteur
curl -X POST -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","visitReason":"OTHER"}' \
  http://localhost:3000/api/visitors

# Test vérification statut
curl http://localhost:3000/api/visitors/VISITOR_ID/status

# Test génération badge
curl -X POST http://localhost:3000/api/badges/generate/VISITOR_ID

# Test vérification badge
curl http://localhost:3000/api/badges/verify/BADGE_ID
```

### Validation de l'Environnement

```bash
# Vérifier les services Docker
docker-compose ps

# Vérifier les logs
docker-compose logs

# Tester la connexion DB
node -e "const prisma = require('./src/config/database'); prisma.adminUser.count().then(console.log).finally(() => prisma.$disconnect())"
```

## 🔄 Déploiement

### Variables d'Environnement Production

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:port/database"
JWT_SECRET="CHANGEZ-MOI-EN-PRODUCTION"
SESSION_SECRET="CHANGEZ-MOI-EN-PRODUCTION"
ALLOWED_ORIGINS="https://votre-domaine.com"
PORT=3000
```

### Déploiement Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Lier le projet
railway link

# Déployer
railway up

# Vérifier le statut
railway status

# Voir les logs
railway logs
```

### Commandes de Déploiement

```bash
# Build pour production
npm ci --only=production

# Générer Prisma client
npx prisma generate

# Appliquer migrations
npx prisma migrate deploy

# Démarrer en production
npm start
```

## 🐛 Dépannage

### Problèmes Courants

1. **Erreur de connexion DB**
   ```bash
   # Vérifier que PostgreSQL est démarré
   docker-compose ps
   ```

2. **Doublons dans la base**
   ```bash
   # Exécuter le script de nettoyage
   node fix-seed-duplicates.js
   ```

3. **Prisma Client désynchronisé**
   ```bash
   npx prisma generate
   ```

4. **Variables d'environnement manquantes**
   ```bash
   # Vérifier que .env existe et contient toutes les variables
   cat .env
   ```

5. **Problème de badges**
   ```bash
   # Vérifier qu'un visiteur existe avant de générer un badge
   curl http://localhost:3000/api/visitors/VISITOR_ID/status
   ```

## 🌐 Intégration Frontend

### Frontend Repository
Le frontend est situé dans un repository séparé avec la structure suivante :
```
gooseCorp_frt/
├── src/
│   ├── api.js              # Services API
│   ├── config.js           # Configuration
│   ├── utils.js            # Utilitaires généraux
│   ├── main.js             # Point d'entrée principal
│   ├── checkout-main.js    # Point d'entrée page checkout
│   ├── entry.js            # Gestion des entrées
│   ├── checkin.js          # Formulaire d'enregistrement
│   ├── checkout.js         # Formulaire de sortie
│   ├── diagnostics.js      # Diagnostic API
│   └── assets/             # Fichiers statiques
├── index.html              # Page d'entrée
├── checkout.html           # Page de sortie
└── package.json
```

### Fonctionnalités Frontend Implémentées

#### 📱 **Page d'Entrée (index.html)**
- ✅ Enregistrement nouveaux visiteurs
- ✅ Re-entrée avec badges existants
- ✅ Vérification automatique des statuts
- ✅ Génération de QR codes pour les visiteurs
- ✅ Validation en temps réel des formulaires
- ✅ Chargement dynamique des données (staff/formations)

#### 🚪 **Page de Sortie (checkout.html)**
- ✅ Sortie visiteurs par ID
- ✅ Vérification des statuts avant checkout
- ✅ Affichage des informations de visite
- ✅ Calcul automatique de la durée de visite
- ✅ Prévention des sorties multiples

#### 🔧 **Fonctionnalités Techniques**
- ✅ API client avec gestion d'erreurs
- ✅ Système de notifications
- ✅ Validation côté client
- ✅ Gestion des états de chargement
- ✅ Interface responsive

### Configuration API Frontend

```javascript
// Configuration recommandée
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    DEMO_MODE: false
};

// Exemple d'utilisation
const response = await fetch(`${CONFIG.API_BASE_URL}/visitors/public/staff`);
const { staff } = await response.json();
```

### Endpoints Utilisés par le Frontend

#### **Données Publiques**
- `GET /api/visitors/public/staff` - Liste du personnel
- `GET /api/visitors/public/formations` - Liste des formations
- `GET /api/visitors/public/health` - Health check

#### **Gestion des Visiteurs**
- `POST /api/visitors` - Enregistrement visiteur
- `GET /api/visitors/:id/status` - Vérification statut
- `POST /api/visitors/:id/checkout` - Sortie visiteur
- `POST /api/visitors/:id/reentry` - Re-entrée visiteur

### CORS Configuration
Le backend accepte les requêtes depuis :
- `http://localhost:5173` (Vite dev server)
- `https://*.netlify.app` (Déploiement Netlify)
- `https://*.railway.app` (Déploiement Railway)
- Mode développement : toutes les origines autorisées

---

## 📞 Support

Pour toute question ou problème :
1. Vérifiez les logs : `docker-compose logs`
2. Consultez la documentation Prisma : https://www.prisma.io/docs
3. Vérifiez l'état des services : `docker-compose ps`
4. Consultez les guides d'intégration : `FRONTEND_INTEGRATION_GUIDE.md`

## 🎯 Statut du Projet

### Backend ✅ **COMPLET**
- ✅ API REST complète avec tous les endpoints
- ✅ Authentification JWT et sécurité
- ✅ Base de données PostgreSQL avec Prisma
- ✅ Interface d'administration web
- ✅ Gestion des visiteurs et badges
- ✅ Historique des visites
- ✅ API publique pour frontend
- ✅ Déploiement Railway configuré

### Frontend ✅ **COMPLET**
- ✅ Interface utilisateur complète
- ✅ Enregistrement et sortie visiteurs
- ✅ Génération de QR codes
- ✅ Vérification automatique des statuts
- ✅ Gestion des badges existants
- ✅ Interface responsive
- ✅ Déploiement Netlify configuré

### Intégration ✅ **FONCTIONNELLE**
- ✅ Communication API backend ↔ frontend
- ✅ CORS configuré pour tous les environnements
- ✅ Gestion d'erreurs et états de chargement
- ✅ Validation côté client et serveur
- ✅ Système de notifications

**Le système GooseCorp est maintenant complet et opérationnel ! 🎉** 