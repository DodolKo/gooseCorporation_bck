// Configuration CORS temporaire pour debugging
// À utiliser uniquement en développement

const cors = require('cors');

// Configuration CORS très permissive pour debugging
const debugCors = cors({
  origin: true, // Permettre toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  optionsSuccessStatus: 200 // Pour les anciens navigateurs
});

// Configuration CORS de développement flexible
const devCors = cors({
  origin: function (origin, callback) {
    console.log(`[CORS DEBUG] Origine reçue: ${origin}`);
    
    // Permettre toutes les requêtes en développement
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // En production, utiliser la liste blanche
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173',
        'http://localhost:8080'
      ];
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Non autorisé par CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token']
});

module.exports = {
  debugCors,
  devCors
}; 