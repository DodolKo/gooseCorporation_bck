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

// Middleware CORS global pour Railway - URGENT FIX
app.use((req, res, next) => {
  // Headers CORS permissifs
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Répondre immédiatement aux requêtes OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Requête OPTIONS autorisée');
    return res.status(200).end();
  }
  
  next();
});

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
      connectSrc: ["'self'", "https://*.netlify.app", "https://*.netlify.com", "https://goosecorporationbck-production.up.railway.app"],
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
  // Configuration pour production - Autoriser Netlify et autres domaines
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    [
      'https://goosecorp-frt.netlify.app',
      'https://*.netlify.app',
      'https://*.netlify.com',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080'
    ];

  // Configuration CORS pour production avec domaines autorisés
  app.use(cors({
    origin: function (origin, callback) {
      // Autoriser les requêtes sans origine (comme les formulaires directs)
      if (!origin) {
        console.log('[CORS] Requête sans origine autorisée');
        return callback(null, true);
      }
      
      // Vérifier si l'origine est dans la liste autorisée
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin.includes('*')) {
          // Gérer les wildcards
          const pattern = allowedOrigin.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return allowedOrigin === origin;
      });
      
      if (isAllowed) {
        console.log(`[CORS] Origine autorisée: ${origin}`);
        return callback(null, true);
      } else {
        console.log(`[CORS] Origine refusée: ${origin}`);
        return callback(new Error('Origine non autorisée par CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'Accept'],
    exposedHeaders: ['X-CSRF-Token'],
    optionsSuccessStatus: 200,
    preflightContinue: false
  }));
  
  console.log('🔓 [CORS] Mode production - TOUTES les origines autorisées pour Railway');
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

// Public endpoints rate limiting (more permissive for frontend)
const publicLimiter = rateLimit({
  windowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW) || 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX) || 200, // 200 requests per 5 minutes
  message: {
    error: 'Trop de requêtes depuis cette IP pour les endpoints publics, veuillez réessayer plus tard.',
    retryAfter: Math.ceil((parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW) || 5 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/visitors/public/health';
  }
});

// Visitor registration rate limiting (anti-spam)
const visitorRegistrationLimiter = rateLimit({
  windowMs: parseInt(process.env.VISITOR_RATE_LIMIT_WINDOW) || 10 * 60 * 1000, // 10 minutes
  max: parseInt(process.env.VISITOR_RATE_LIMIT_MAX) || 10, // 10 registrations per 10 minutes per IP
  message: {
    error: 'Trop d\'inscriptions depuis cette IP, veuillez réessayer plus tard.',
    retryAfter: Math.ceil((parseInt(process.env.VISITOR_RATE_LIMIT_WINDOW) || 10 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
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

// Apply specific rate limiting for public endpoints
app.use('/api/visitors/public', publicLimiter);

// Apply specific rate limiting for visitor registration
app.use('/api/visitors', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') {
    return visitorRegistrationLimiter(req, res, next);
  }
  next();
});

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
  
  // Erreur CORS - NE PAS BLOQUER
  if (err.message && err.message.includes('CORS')) {
    console.log('[CORS] Erreur CORS ignorée pour Railway');
    return next(); // Continuer au lieu de bloquer
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

