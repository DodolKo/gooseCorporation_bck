const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const csrf = require('csurf');
const path = require('path');
require('dotenv').config();

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false // Pour compatibilité avec certains CDN
}));

// CORS configuration temporaire très permissive pour debugging
if (process.env.NODE_ENV === 'development') {
  // Configuration très permissive en développement
  app.use(cors({
    origin: true, // Permettre toutes les origines
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
    optionsSuccessStatus: 200
  }));
  
  console.log('🔓 [CORS] Mode développement - Toutes les origines autorisées');
} else {
  // Configuration sécurisée pour production
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080'];

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      console.log(`[CORS] Origine rejetée: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token']
  }));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  }
});

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Ne pas compter les connexions réussies
});

// Logging avancé
app.use(morgan('combined'));

// Middleware d'audit logging
app.use((req, res, next) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    userId: req.user?.userId || 'anonymous'
  };
  
  // Log uniquement les requêtes importantes (pas les assets statiques)
  if (!req.path.startsWith('/static') && req.path !== '/health') {
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
  }
  
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 heures
    sameSite: 'strict'
  },
  name: 'goosecorp.sid' // Nom de session personnalisé
}));

// CSRF protection pour les formulaires web
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Static files
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/admin/login', loginLimiter);
app.use('/admin/login-web', loginLimiter);

// Routes API (sans CSRF)
app.use('/api/visitors', require('./routes/visitors'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/admin', require('./routes/adminApi'));

// Admin web interface (avec CSRF)
app.use('/admin', csrfProtection, require('./routes/adminWeb'));

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// Health check (sans rate limiting ni CSRF)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path} - IP: ${req.ip}`);
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.stack}`);
  
  // Erreur CORS
  if (err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Accès CORS refusé' });
  }
  
  // Erreur CSRF
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Token CSRF invalide' });
  }
  
  // Erreur de rate limiting
  if (err.status === 429) {
    return res.status(429).json({ error: 'Trop de requêtes' });
  }
  
  // Erreur générique
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 
      'Erreur interne du serveur' : 
      err.message 
  });
});

module.exports = app;

