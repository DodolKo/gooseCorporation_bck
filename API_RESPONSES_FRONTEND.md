# 📋 Réponses API - Équipe Frontend GooseCorp

## 1. 🚪 Endpoint de Sortie (Check-out)

### ✅ **L'endpoint existe !**

**URL exacte :**
```
POST /api/visitors/:identifier/checkout
```

**Paramètres :**
- `identifier` : ID numérique ou `uniqueId` du visiteur
- Aucun paramètre dans le body requis

**Format de réponse :**
```json
{
  "message": "Visitor checked out successfully",
  "visitor": {
    "id": 1,
    "uniqueId": "clx1234567890",
    "firstName": "Marie",
    "lastName": "Dupont",
    "email": "marie@example.com",
    "status": "OUTSIDE",
    "checkInTime": "2025-01-15T09:00:00Z",
    "checkOutTime": "2025-01-15T17:00:00Z",
    "staff": { ... },
    "formation": { ... },
    "badge": { ... }
  }
}
```

**Actions automatiques :**
- ✅ Met à jour le statut vers `OUTSIDE`
- ✅ Enregistre l'heure de sortie
- ✅ Crée une entrée dans l'historique des visites
- ✅ Désactive le badge si présent

---

## 2. 📋 Récupération des Données Publiques

### ❌ **PROBLÈME : Pas d'endpoints publics actuellement**

**Situation actuelle :**
- `GET /api/admin/staff` - **Protégé** (nécessite JWT)
- `GET /api/admin/formations` - **Protégé** (nécessite JWT)

**Solution :** L'équipe backend doit créer des endpoints publics spécifiques :

```javascript
// À ajouter par l'équipe backend
// GET /api/public/staff - Liste du personnel actif
router.get('/public/staff', async (req, res) => {
  const staff = await prisma.gooseCorpStaff.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      position: true
    },
    orderBy: { firstName: 'asc' }
  });
  res.json({ staff });
});

// GET /api/public/formations - Liste des formations actives
router.get('/public/formations', async (req, res) => {
  const formations = await prisma.gooseCorpFormation.findMany({
    where: { 
      isActive: true,
      startDate: { gte: new Date() }
    },
    select: {
      id: true,
      name: true,
      description: true,
      location: true,
      startDate: true,
      endDate: true,
      instructor: true
    },
    orderBy: { startDate: 'asc' }
  });
  res.json({ formations });
});
```

---

## 3. ✅ Validation des Données

### **Champs obligatoires :**
```javascript
const visitorValidation = [
  body('firstName').trim().isLength({ min: 2 }), // 2 caractères minimum
  body('lastName').trim().isLength({ min: 2 }),   // 2 caractères minimum
  body('email').isEmail(),                        // Format email valide
  body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/), // Format téléphone
  body('company').optional().trim().isLength({ min: 2 }),
  body('visitReason').isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']),
  body('staffId').optional().isInt(),             // Si MEETING
  body('formationId').optional().isInt()          // Si FORMATION
];
```

### **Validations côté serveur :**
- ✅ Format email validé
- ✅ Longueur des champs vérifiée
- ✅ Raison de visite dans la liste autorisée
- ✅ `staffId` requis si `visitReason === 'MEETING'`
- ✅ `formationId` requis si `visitReason === 'FORMATION'`
- ✅ Vérification que le staff/formation existe et est actif

### **Gestion des erreurs :**
```json
{
  "errors": [
    {
      "type": "field",
      "value": "invalid-email",
      "msg": "Valid email is required",
      "path": "email",
      "location": "body"
    }
  ]
}
```

---

## 4. 🚨 Gestion des Erreurs

### **Codes d'erreur HTTP :**
- `200` : Succès
- `201` : Créé avec succès
- `400` : Erreur de validation
- `401` : Non authentifié
- `403` : Non autorisé
- `404` : Ressource non trouvée
- `429` : Trop de requêtes (rate limiting)
- `500` : Erreur serveur

### **Messages d'erreur spécifiques :**
```json
{
  "error": "Staff ID is required for meetings"
}
{
  "error": "Staff member not found or inactive"
}
{
  "error": "Visitor is already checked out"
}
{
  "error": "Email already exists"
}
```

---

## 5. 🛡️ Sécurité

### **Rate Limiting :**
- ✅ **API générale** : 100 requêtes/15 minutes
- ✅ **Login** : 5 tentatives/15 minutes
- ⚠️ **Endpoints publics** : Même limite que l'API générale

### **Protection anti-spam :**
- ✅ Rate limiting déjà en place
- ✅ Validation stricte des données
- ⚠️ **Recommandation** : Ajouter un captcha pour l'inscription publique

---

## 6. 📝 Format des Réponses

### **POST /api/visitors (Inscription) :**
```json
{
  "message": "Visitor registered successfully",
  "visitor": {
    "id": 1,
    "uniqueId": "clx1234567890",  // ✅ Inclus
    "firstName": "Marie",
    "lastName": "Dupont",
    "email": "marie@example.com",
    "phone": "+32123456789",
    "company": "Acme Corp",
    "visitReason": "MEETING",
    "status": "INSIDE",
    "checkInTime": "2025-01-15T09:00:00Z",  // ✅ Date/heure incluses
    "createdAt": "2025-01-15T09:00:00Z",    // ✅ Date/heure incluses
    "staff": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "department": "IT"
    }
  }
}
```

---

## 🎯 Recommandations pour l'équipe Backend

1. **Créer les endpoints publics** pour staff et formations
2. **Ajouter un captcha** pour l'inscription publique
3. **Documenter les nouveaux endpoints** dans le wiki
4. **Tester les validations** avec des cas limites

---

## 📋 Checklist pour le Frontend

- ✅ Endpoint checkout : `POST /api/visitors/:uniqueId/checkout`
- ⚠️ Endpoints publics : À créer par le backend
- ✅ Validation : Complète et documentée
- ✅ Gestion d'erreurs : Standardisée
- ✅ Sécurité : Rate limiting en place
- ✅ Format de réponse : Inclut `uniqueId` et dates

---

## 🚀 Actions Immédiates

**L'équipe frontend peut commencer avec :**
1. ✅ Endpoint checkout : `POST /api/visitors/:uniqueId/checkout`
2. ✅ Inscription visiteur : `POST /api/visitors`
3. ⚠️ **En attente** : Endpoints publics pour les listes staff/formations

**L'équipe backend doit créer :**
1. `GET /api/public/staff` - Liste du personnel actif
2. `GET /api/public/formations` - Liste des formations actives
3. Captcha pour l'inscription publique

---

*Document généré automatiquement - GooseCorp Backend Team* 🏢 