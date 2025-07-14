#!/bin/bash

# ========================================
# SCRIPT DE DÉPLOIEMENT RAILWAY
# ========================================
# Usage: ./scripts/deploy-railway.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage du déploiement Railway..."

# ========================================
# VÉRIFICATIONS PRÉ-DÉPLOIEMENT
# ========================================

echo "📋 Vérifications pré-déploiement..."

# Vérifier que nous sommes sur la branche prod
if [ "$(git branch --show-current)" != "prod" ]; then
    echo "❌ ERREUR: Vous devez être sur la branche 'prod' pour déployer"
    echo "   Commande: git checkout prod"
    exit 1
fi

# Vérifier que le fichier .env.production existe
if [ ! -f ".env.production" ]; then
    echo "❌ ERREUR: Fichier .env.production manquant"
    echo "   Créez-le avec: cp .env.example .env.production"
    exit 1
fi

# Vérifier que les secrets sont configurés
if grep -q "your-super-secret" .env.production; then
    echo "❌ ERREUR: Les secrets dans .env.production ne sont pas configurés"
    echo "   Générez des secrets sécurisés et mettez à jour .env.production"
    exit 1
fi

# Vérifier que Prisma est généré
if [ ! -d "src/generated/prisma" ]; then
    echo "📦 Génération du client Prisma..."
    npx prisma generate
fi

# ========================================
# TESTS LOCAUX
# ========================================

echo "🧪 Tests locaux..."

# Test de syntaxe Node.js
echo "   ✓ Vérification syntaxe..."
node -c src/server.js

# Test de connexion à la base de données (si disponible)
if command -v docker &> /dev/null && docker ps | grep -q "gooseCorp-postgres"; then
    echo "   ✓ Test connexion DB..."
    node -e "
        const prisma = require('./src/config/database');
        prisma.adminUser.count()
            .then(count => {
                console.log('   ✓ DB connectée,', count, 'admins trouvés');
                process.exit(0);
            })
            .catch(err => {
                console.log('   ⚠️  DB non accessible (normal pour production)');
                process.exit(0);
            })
            .finally(() => prisma.\$disconnect());
    "
else
    echo "   ⚠️  DB Docker non disponible (normal pour production)"
fi

# ========================================
# PRÉPARATION DU DÉPLOIEMENT
# ========================================

echo "📦 Préparation du déploiement..."

# Vérifier que Railway CLI est installé
if ! command -v railway &> /dev/null; then
    echo "❌ ERREUR: Railway CLI non installé"
    echo "   Installez-le avec: npm install -g @railway/cli"
    exit 1
fi

# Vérifier la connexion Railway
echo "   ✓ Vérification connexion Railway..."
railway status

# ========================================
# DÉPLOIEMENT
# ========================================

echo "🚀 Déploiement sur Railway..."

# Déployer
railway up

# ========================================
# VÉRIFICATIONS POST-DÉPLOIEMENT
# ========================================

echo "✅ Vérifications post-déploiement..."

# Attendre que l'app soit prête
echo "   ⏳ Attente du démarrage de l'application..."
sleep 10

# Récupérer l'URL de l'app
APP_URL=$(railway domain)
echo "   🌐 URL de l'application: $APP_URL"

# Test du health check
echo "   🏥 Test du health check..."
if curl -f -s "$APP_URL/health" > /dev/null; then
    echo "   ✅ Health check réussi"
else
    echo "   ❌ Health check échoué"
    echo "   Vérifiez les logs: railway logs"
    exit 1
fi

# ========================================
# FINALISATION
# ========================================

echo ""
echo "🎉 DÉPLOIEMENT RÉUSSI !"
echo "========================================"
echo "🌐 URL: $APP_URL"
echo "📊 Dashboard: https://railway.app/dashboard"
echo "📝 Logs: railway logs"
echo "🔧 Variables d'environnement: railway variables"
echo ""
echo "⚠️  N'OUBLIEZ PAS:"
echo "   1. Configurer DATABASE_URL dans Railway"
echo "   2. Configurer JWT_SECRET dans Railway"
echo "   3. Configurer SESSION_SECRET dans Railway"
echo "   4. Configurer ALLOWED_ORIGINS dans Railway"
echo "   5. Tester l'API: $APP_URL/health"
echo ""

# Ouvrir l'URL dans le navigateur
if command -v xdg-open &> /dev/null; then
    xdg-open "$APP_URL"
elif command -v open &> /dev/null; then
    open "$APP_URL"
fi 