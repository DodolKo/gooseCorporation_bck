# 🏢 GooseCorp Backend - Système de Gestion des Visiteurs

## 📋 Vue d'ensemble

GooseCorp Backend est une API REST sécurisée pour la gestion des visiteurs, du personnel et des formations dans un bâtiment d'entreprise. Le système comprend un CMS d'administration complet avec authentification JWT.

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

### Structure du Projet

```
gooseCorp_bck/
├── src/
│   ├── config/
│   │   └── database.js          # Configuration Prisma
│   ├── routes/
│   │   ├── adminApi.js          # API REST pour l'admin
│   │   ├── adminWeb.js          # Interface web d'administration
│   │   └── visitors.js          # API pour les visiteurs
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
├── .env                         # Variables d'environnement
└── package.json
```

## 🗄️ Modèle de Données

### Entités Principales

- **AdminUser**: Utilisateurs administrateurs du système
- **GooseCorpUser**: Visiteurs enregistrés
- **GooseCorpStaff**: Personnel de l'entreprise
- **GooseCorpFormation**: Formations/événements
- **Visit**: Historique des entrées/sorties
- **Badge**: Badges d'accès temporaires
- **Log**: Journalisation des actions

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
| GET | `/api/admin/logs` | Journaux d'activité |

### Public

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Vérification de santé |
| POST | `/api/visitors/register` | Enregistrement visiteur |

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

## 🚀 Prochaines Étapes - Frontend

Le backend est maintenant prêt pour l'intégration frontend. Points clés pour le développement frontend :

### API Base URL
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Authentification
- Utiliser JWT pour l'authentification API
- Stocker le token en localStorage ou sessionStorage
- Inclure le token dans les headers : `Authorization: Bearer ${token}`

### Endpoints Principaux
- `/api/admin/login` - Authentification
- `/api/admin/dashboard` - Données du tableau de bord
- `/api/visitors/register` - Enregistrement visiteurs
- `/api/admin/visitors` - CRUD visiteurs

### CORS
Le backend accepte les requêtes depuis :
- `http://localhost:3000` (React dev server)
- `http://localhost:3001` 
- `http://localhost:5173` (Vite)
- `http://localhost:8080`

---

## 📞 Support

Pour toute question ou problème :
1. Vérifiez les logs : `docker-compose logs`
2. Consultez la documentation Prisma : https://www.prisma.io/docs
3. Vérifiez l'état des services : `docker-compose ps`

**Le système est maintenant prêt pour le développement du frontend ! 🚀** 