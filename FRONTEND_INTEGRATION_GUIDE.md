# 🚀 Guide d'Intégration Frontend - GooseCorp

## ✅ **NOUVEAUX ENDPOINTS DISPONIBLES**

### 📋 **Endpoints Publics (Sans Authentification)**

#### **1. Liste du Personnel**
```javascript
GET /api/visitors/public/staff
```

**Réponse :**
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

#### **2. Liste des Formations**
```javascript
GET /api/visitors/public/formations
```

**Réponse :**
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

#### **3. Health Check**
```javascript
GET /api/visitors/public/health
```

**Réponse :**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

---

## 🔒 **SÉCURITÉ IMPLÉMENTÉE**

### **Rate Limiting Configuré**

| Endpoint | Limite | Fenêtre | Description |
|----------|--------|---------|-------------|
| `/api/visitors/public/*` | 200 requêtes | 5 minutes | Endpoints publics |
| `/api/visitors` (POST) | 10 inscriptions | 10 minutes | Inscription visiteurs |
| `/api/*` (autres) | 100 requêtes | 15 minutes | API générale |

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

## 💻 **EXEMPLE D'INTÉGRATION FRONTEND**

### **Configuration API Client**
```javascript
// config/api.js
const API_BASE_URL = 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour gérer les erreurs de rate limiting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limit atteint. Réessayer dans ${retryAfter} secondes`);
      
      // Optionnel : Afficher un message à l'utilisateur
      showNotification('Trop de requêtes. Veuillez patienter quelques minutes.');
    }
    return Promise.reject(error);
  }
);
```

### **Service pour les Données Publiques**
```javascript
// services/publicDataService.js
class PublicDataService {
  static async getStaff() {
    try {
      const response = await apiClient.get('/visitors/public/staff');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération du personnel:', error);
      throw error;
    }
  }

  static async getFormations() {
    try {
      const response = await apiClient.get('/visitors/public/formations');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des formations:', error);
      throw error;
    }
  }

  static async checkHealth() {
    try {
      const response = await apiClient.get('/visitors/public/health');
      return response.data;
    } catch (error) {
      console.error('Erreur lors du health check:', error);
      throw error;
    }
  }
}
```

### **Service d'Inscription Visiteur**
```javascript
// services/visitorService.js
class VisitorService {
  static async registerVisitor(visitorData) {
    try {
      const response = await apiClient.post('/visitors', visitorData);
      return response.data;
    } catch (error) {
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        
        // Gestion des erreurs spécifiques
        if (errorData.error?.includes('déjà enregistré')) {
          throw new Error('Ce visiteur est déjà présent dans le bâtiment');
        }
        
        if (errorData.errors) {
          // Erreurs de validation
          const validationErrors = errorData.errors.map(err => err.msg);
          throw new Error(validationErrors.join(', '));
        }
      }
      
      throw error;
    }
  }

  static async checkoutVisitor(uniqueId) {
    try {
      const response = await apiClient.post(`/visitors/${uniqueId}/checkout`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la sortie:', error);
      throw error;
    }
  }
}
```

### **Exemple d'Utilisation React**
```javascript
// components/VisitorRegistration.jsx
import React, { useState, useEffect } from 'react';
import { PublicDataService, VisitorService } from '../services';

const VisitorRegistration = () => {
  const [staff, setStaff] = useState([]);
  const [formations, setFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    visitReason: 'MEETING',
    staffId: '',
    formationId: ''
  });

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    try {
      const [staffData, formationsData] = await Promise.all([
        PublicDataService.getStaff(),
        PublicDataService.getFormations()
      ]);
      
      setStaff(staffData.staff);
      setFormations(formationsData.formations);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const result = await VisitorService.registerVisitor(formData);
      
      // Succès - Afficher le QR code ou l'ID unique
      console.log('Visiteur enregistré:', result.visitor.uniqueId);
      
      // Rediriger ou afficher un message de succès
      showSuccess(`Bienvenue ${result.visitor.firstName}! Votre ID: ${result.visitor.uniqueId}`);
      
    } catch (error) {
      showError(error.message);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <form onSubmit={handleSubmit}>
      {/* Champs du formulaire */}
      <input
        type="text"
        placeholder="Prénom"
        value={formData.firstName}
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
        required
      />
      
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      
      <select
        value={formData.visitReason}
        onChange={(e) => setFormData({...formData, visitReason: e.target.value})}
      >
        <option value="MEETING">Rendez-vous</option>
        <option value="FORMATION">Formation</option>
        <option value="OTHER">Autre</option>
        <option value="DELIVERY">Livraison</option>
        <option value="MAINTENANCE">Maintenance</option>
      </select>
      
      {formData.visitReason === 'MEETING' && (
        <select
          value={formData.staffId}
          onChange={(e) => setFormData({...formData, staffId: e.target.value})}
          required
        >
          <option value="">Sélectionner un membre du personnel</option>
          {staff.map(member => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName} - {member.department}
            </option>
          ))}
        </select>
      )}
      
      {formData.visitReason === 'FORMATION' && (
        <select
          value={formData.formationId}
          onChange={(e) => setFormData({...formData, formationId: e.target.value})}
          required
        >
          <option value="">Sélectionner une formation</option>
          {formations.map(formation => (
            <option key={formation.id} value={formation.id}>
              {formation.name} - {new Date(formation.startDate).toLocaleDateString()}
            </option>
          ))}
        </select>
      )}
      
      <button type="submit">S'inscrire</button>
    </form>
  );
};
```

---

## 📊 **MONITORING ET DEBUGGING**

### **Vérification de Santé**
```javascript
// Vérifier que l'API est accessible
const healthCheck = async () => {
  try {
    const health = await PublicDataService.checkHealth();
    console.log('API Status:', health.status);
    return health.status === 'healthy';
  } catch (error) {
    console.error('API non disponible:', error);
    return false;
  }
};
```

### **Gestion des Erreurs**
```javascript
// Codes d'erreur à gérer
const ERROR_CODES = {
  400: 'Données invalides',
  404: 'Ressource non trouvée',
  429: 'Trop de requêtes',
  500: 'Erreur serveur'
};

const handleApiError = (error) => {
  const status = error.response?.status;
  const message = ERROR_CODES[status] || 'Erreur inconnue';
  
  console.error(`Erreur API (${status}):`, message);
  
  // Afficher un message à l'utilisateur
  showNotification(message, 'error');
};
```

---

## 🔧 **CONFIGURATION RECOMMANDÉE**

### **Variables d'Environnement Frontend**
```javascript
// .env.local
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_ENABLE_HEALTH_CHECK=true
REACT_APP_RETRY_ATTEMPTS=3
REACT_APP_RETRY_DELAY=1000
```

### **Optimisations**
```javascript
// Cache des données publiques (React Query exemple)
const useStaff = () => {
  return useQuery('staff', PublicDataService.getStaff, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });
};

const useFormations = () => {
  return useQuery('formations', PublicDataService.getFormations, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });
};
```

---

## ✅ **CHECKLIST FRONTEND**

- [ ] Tester les endpoints publics
- [ ] Implémenter la gestion des erreurs de rate limiting
- [ ] Ajouter un système de cache pour les données publiques
- [ ] Tester l'inscription avec différents scénarios
- [ ] Implémenter le checkout des visiteurs
- [ ] Ajouter un health check au démarrage
- [ ] Tester en mode production avec HTTPS

---

## 🚀 **PRÊT POUR LE DÉVELOPPEMENT**

L'équipe frontend peut maintenant :

1. **Commencer immédiatement** avec les endpoints publics
2. **Implémenter l'inscription** des visiteurs
3. **Gérer les sorties** avec le checkout
4. **Intégrer la sécurité** avec les rate limits
5. **Optimiser les performances** avec le cache

**Tous les endpoints sont fonctionnels et sécurisés !** 🎉

---

*Guide généré automatiquement - GooseCorp Backend Team* 🏢 