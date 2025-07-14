# 📝 Notes de Développement - Équipe Frontend GooseCorp

## 🆕 **NOUVEAUTÉS AJOUTÉES POUR LE FRONTEND**

### ✅ **Endpoints Publics Disponibles**

#### **1. Récupération du Personnel**
```javascript
GET /api/visitors/public/staff
```
**Utilisation :** Remplir les listes déroulantes pour les rendez-vous
**Réponse :** Liste du personnel actif avec département et position

#### **2. Récupération des Formations**
```javascript
GET /api/visitors/public/formations
```
**Utilisation :** Remplir les listes déroulantes pour les formations
**Réponse :** Formations futures et actuelles avec détails complets

#### **3. Health Check Frontend**
```javascript
GET /api/visitors/public/health
```
**Utilisation :** Vérifier la disponibilité de l'API au démarrage
**Réponse :** Status de santé avec timestamp

---

## 🔒 **SÉCURITÉ IMPLÉMENTÉE**

### **Rate Limiting Configuré**
- **Endpoints publics** : 200 requêtes / 5 minutes
- **Inscription visiteurs** : 10 inscriptions / 10 minutes
- **API générale** : 100 requêtes / 15 minutes

### **Headers de Sécurité**
```http
Cache-Control: public, max-age=300
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### **Gestion des Visiteurs Récurrents**
- ✅ **Emails dupliqués autorisés** pour différentes visites
- ❌ **Blocage si visiteur déjà présent** (status: INSIDE)
- ✅ **Message d'erreur explicite** avec suggestion

---

## 🚨 **POINTS D'ATTENTION**

### **Gestion des Erreurs 429 (Rate Limiting)**
```javascript
// Intercepteur recommandé
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      showNotification(`Trop de requêtes. Réessayer dans ${retryAfter} secondes`);
    }
    return Promise.reject(error);
  }
);
```

### **Validation Email Améliorée**
- **Avant** : Emails uniques obligatoires
- **Maintenant** : Emails dupliqués autorisés, mais blocage si visiteur déjà présent
- **Message d'erreur** : "Un visiteur avec cet email est déjà enregistré comme présent"

---

## 📊 **FORMATS DE RÉPONSE**

### **Staff Public**
```json
{
  "staff": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "department": "IT",
      "position": "Developer",
      "email": "john.doe@goosecorp.com"
    }
  ],
  "count": 1,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### **Formations Public**
```json
{
  "formations": [
    {
      "id": 1,
      "name": "Formation Sécurité",
      "description": "Formation obligatoire sécurité",
      "location": "Salle A1",
      "startDate": "2025-01-20T09:00:00Z",
      "endDate": "2025-01-20T17:00:00Z",
      "instructor": "Marie Martin",
      "maxParticipants": 20,
      "currentParticipants": 15
    }
  ],
  "count": 1,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 🔧 **CONFIGURATION RECOMMANDÉE**

### **Variables d'Environnement**
```javascript
// .env.local
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_ENABLE_HEALTH_CHECK=true
REACT_APP_RETRY_ATTEMPTS=3
REACT_APP_RETRY_DELAY=1000
```

### **Cache Recommandé**
```javascript
// React Query ou équivalent
const useStaff = () => {
  return useQuery('staff', PublicDataService.getStaff, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });
};
```

---

## 🎯 **WORKFLOW RECOMMANDÉ**

### **1. Au Démarrage de l'App**
```javascript
// Vérifier la santé de l'API
const healthCheck = async () => {
  try {
    const health = await PublicDataService.checkHealth();
    return health.status === 'healthy';
  } catch (error) {
    console.error('API non disponible:', error);
    return false;
  }
};
```

### **2. Chargement des Données**
```javascript
// Charger en parallèle
const loadPublicData = async () => {
  const [staffData, formationsData] = await Promise.all([
    PublicDataService.getStaff(),
    PublicDataService.getFormations()
  ]);
  return { staff: staffData.staff, formations: formationsData.formations };
};
```

### **3. Inscription Visiteur**
```javascript
// Gestion des erreurs spécifiques
try {
  const result = await VisitorService.registerVisitor(formData);
  showSuccess(`Bienvenue ${result.visitor.firstName}!`);
} catch (error) {
  if (error.message.includes('déjà enregistré')) {
    showError('Ce visiteur est déjà présent dans le bâtiment');
  } else {
    showError(error.message);
  }
}
```

---

## ✅ **CHECKLIST DÉVELOPPEMENT**

### **Phase 1 - Configuration**
- [ ] Configurer l'API client avec intercepteurs
- [ ] Ajouter les variables d'environnement
- [ ] Implémenter le health check au démarrage

### **Phase 2 - Données Publiques**
- [ ] Créer les services pour staff et formations
- [ ] Implémenter le cache des données
- [ ] Tester les endpoints publics

### **Phase 3 - Inscription**
- [ ] Créer le formulaire d'inscription
- [ ] Implémenter la validation côté client
- [ ] Gérer les erreurs de rate limiting
- [ ] Tester les scénarios de visiteurs récurrents

### **Phase 4 - Checkout**
- [ ] Implémenter l'endpoint de sortie
- [ ] Créer l'interface de checkout
- [ ] Tester le flux complet

### **Phase 5 - Optimisation**
- [ ] Ajouter les retry automatiques
- [ ] Optimiser les performances
- [ ] Tester en mode production

---

## 🚀 **DÉMARRAGE RAPIDE**

### **1. Tester les Endpoints**
```bash
# Test staff
curl http://localhost:3000/api/visitors/public/staff

# Test formations
curl http://localhost:3000/api/visitors/public/formations

# Test health
curl http://localhost:3000/api/visitors/public/health
```

### **2. Exemple d'Inscription**
```bash
curl -X POST http://localhost:3000/api/visitors \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Marie",
    "lastName": "Dupont",
    "email": "marie@example.com",
    "visitReason": "MEETING",
    "staffId": 1
  }'
```

---

## 📋 **FICHIERS DE RÉFÉRENCE**

- **`FRONTEND_INTEGRATION_GUIDE.md`** - Guide complet d'intégration
- **`API_RESPONSES_FRONTEND.md`** - Réponses aux questions de l'équipe
- **`src/routes/visitors.js`** - Code source des endpoints publics

---

## 🎉 **RÉSUMÉ**

**L'équipe frontend peut maintenant :**

1. ✅ **Commencer immédiatement** avec les endpoints publics
2. ✅ **Implémenter l'inscription** avec validation robuste
3. ✅ **Gérer les sorties** avec l'endpoint checkout
4. ✅ **Intégrer la sécurité** avec gestion des rate limits
5. ✅ **Optimiser les performances** avec cache et retry

**Tous les endpoints sont fonctionnels, sécurisés et documentés !**

---

*Notes générées automatiquement - GooseCorp Backend Team* 🏢
