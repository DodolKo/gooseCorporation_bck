# 🚀 Guide API Frontend - GooseCorp

## 📡 Configuration de Base

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

// Intercepteur pour ajouter le token JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 🔐 Authentification

### Login Admin
```javascript
// POST /api/admin/login
const login = async (email, password) => {
  const response = await axios.post(`${API_BASE_URL}/admin/login`, {
    email,
    password
  });
  
  // Sauvegarder le token
  localStorage.setItem('adminToken', response.data.token);
  return response.data;
};

// Exemple d'utilisation
const loginData = await login('admin@goosecorp.com', 'Admin123!');
```

## 👥 Gestion du Personnel

### Lister le Personnel
```javascript
// GET /api/admin/staff
const getStaff = async (params = {}) => {
  const response = await apiClient.get('/admin/staff', { params });
  return response.data;
};

// Exemple
const staff = await getStaff({
  page: 1,
  limit: 50,
  search: 'john',
  department: 'IT',
  isActive: true
});
```

### Ajouter Personnel
```javascript
// POST /api/admin/staff
const addStaff = async (staffData) => {
  const response = await apiClient.post('/admin/staff', staffData);
  return response.data;
};

// Exemple
const newStaff = await addStaff({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@goosecorp.com',
  phone: '+32123456789',
  department: 'IT',
  office: 'Bureau 101',
  position: 'Développeur',
  isActive: true
});
```

### Modifier Personnel
```javascript
// PUT /api/admin/staff/:id
const updateStaff = async (id, staffData) => {
  const response = await apiClient.put(`/admin/staff/${id}`, staffData);
  return response.data;
};
```

### Supprimer Personnel
```javascript
// DELETE /api/admin/staff/:id
const deleteStaff = async (id) => {
  const response = await apiClient.delete(`/admin/staff/${id}`);
  return response.data;
};
```

## 🎓 Gestion des Formations

### Lister les Formations
```javascript
// GET /api/admin/formations
const getFormations = async (params = {}) => {
  const response = await apiClient.get('/admin/formations', { params });
  return response.data;
};

// Exemple
const formations = await getFormations({
  page: 1,
  search: 'sécurité',
  isActive: true,
  startDate: '2025-01-01',
  endDate: '2025-12-31'
});
```

### Ajouter Formation
```javascript
// POST /api/admin/formations
const addFormation = async (formationData) => {
  const response = await apiClient.post('/admin/formations', formationData);
  return response.data;
};

// Exemple
const newFormation = await addFormation({
  name: 'Formation Sécurité',
  description: 'Formation sur la sécurité informatique',
  location: 'Salle A',
  startDate: '2025-02-01T09:00:00Z',
  endDate: '2025-02-01T17:00:00Z',
  maxAttendees: 20,
  instructor: 'Expert Sécurité',
  isActive: true
});
```

### Modifier Formation
```javascript
// PUT /api/admin/formations/:id
const updateFormation = async (id, formationData) => {
  const response = await apiClient.put(`/admin/formations/${id}`, formationData);
  return response.data;
};
```

### Supprimer Formation
```javascript
// DELETE /api/admin/formations/:id
const deleteFormation = async (id) => {
  const response = await apiClient.delete(`/admin/formations/${id}`);
  return response.data;
};
```

## 👤 Gestion des Visiteurs

### Lister les Visiteurs
```javascript
// GET /api/admin/visitors
const getVisitors = async (params = {}) => {
  const response = await apiClient.get('/admin/visitors', { params });
  return response.data;
};
```

### Ajouter Visiteur (Public)
```javascript
// POST /api/visitors (pas d'auth requise)
const registerVisitor = async (visitorData) => {
  const response = await axios.post(`${API_BASE_URL}/visitors`, visitorData);
  return response.data;
};

// Exemple
const visitor = await registerVisitor({
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  phone: '+32123456789',
  company: 'Acme Corp',
  visitReason: 'MEETING',
  staffId: 1  // ID du staff à rencontrer
});
```

## 📊 Dashboard & Statistiques

### Données Dashboard
```javascript
// GET /api/admin/dashboard
const getDashboard = async () => {
  const response = await apiClient.get('/admin/dashboard');
  return response.data;
};

// Retourne:
// {
//   stats: { totalVisitors, totalStaff, totalFormations, ... },
//   currentVisitors: [...],
//   recentActivity: [...]
// }
```

### Historique des Visites
```javascript
// GET /api/admin/history
const getHistory = async (params = {}) => {
  const response = await apiClient.get('/admin/history', { params });
  return response.data;
};

// Exemple
const history = await getHistory({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  action: 'CHECK_IN',
  search: 'marie'
});
```

## 🏥 Health Check
```javascript
// GET /health (pas d'auth requise)
const checkHealth = async () => {
  const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/health`);
  return response.data;
};
```

## 📝 Modèles de Données

### Staff
```typescript
interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  office?: string;
  position?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Formation
```typescript
interface Formation {
  id: number;
  name: string;
  description?: string;
  location: string;
  startDate?: string;
  endDate?: string;
  maxAttendees?: number;
  instructor?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Visitor
```typescript
interface Visitor {
  id: number;
  uniqueId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  visitReason: 'MEETING' | 'FORMATION' | 'OTHER';
  staffId?: number;
  formationId?: number;
  status: 'INSIDE' | 'OUTSIDE';
  checkInTime: string;
  checkOutTime?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 🔄 Gestion des Erreurs

```javascript
// Intercepteur pour gérer les erreurs
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré, rediriger vers login
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 🚀 Structure Frontend Recommandée

```
frontend/
├── src/
│   ├── api/
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── staff.js
│   │   ├── formations.js
│   │   └── visitors.js
│   ├── components/
│   ├── pages/
│   └── utils/
├── public/
└── package.json
```

## 📦 Dépendances Recommandées

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "react-query": "^3.39.0"
  }
}
```

## 🔧 Configuration CORS

Le backend accepte toutes les origines en développement. En production, configurez les origines autorisées dans `src/app.js`.

---

**🎯 Avec cette documentation, vous avez tout ce qu'il faut pour créer le frontend !** 