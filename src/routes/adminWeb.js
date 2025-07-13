const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const prisma = require('../config/database');

// Middleware to verify JWT token for web pages (redirects to login)
const authenticateWeb = (req, res, next) => {
  const token = req.cookies?.adminToken;

  if (!token) {
    return res.redirect('/admin/login');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.redirect('/admin/login');
    }
    req.user = user;
    next();
  });
};

// =============================================================================
// WEB PAGES (SSR) - CMS/Admin Interface
// =============================================================================



// Admin login page
router.get('/login', (req, res) => {
  res.render('admin/login', { 
    title: 'Admin Login - GooseCorp',
    error: null,
    csrfToken: req.csrfToken()
  });
});

// Handle admin login form
router.post('/login-web', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('admin/login', { 
        title: 'Admin Login - GooseCorp',
        error: errors.array()[0].msg,
        csrfToken: req.csrfToken()
      });
    }

    const { email, password } = req.body;

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.render('admin/login', { 
        title: 'Admin Login - GooseCorp',
        error: 'Invalid credentials',
        csrfToken: req.csrfToken()
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.render('admin/login', { 
        title: 'Admin Login - GooseCorp',
        error: 'Invalid credentials',
        csrfToken: req.csrfToken()
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('adminToken', token, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log the login
    await prisma.log.create({
      data: {
        action: 'WEB_LOGIN',
        details: `Admin web login: ${admin.email}`,
        adminId: admin.id
      }
    });

    res.redirect('/admin/dashboard');

  } catch (error) {
    console.error('Error during web login:', error);
    res.render('admin/login', { 
      title: 'Admin Login - GooseCorp',
      error: 'Login failed',
      csrfToken: req.csrfToken()
    });
  }
});

// Admin logout
router.get('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.redirect('/admin/login');
});

// Admin dashboard page
router.get('/dashboard', authenticateWeb, async (req, res) => {
  try {
    // Get dashboard data
    const dashboardData = await getDashboardData();
    
    res.render('admin/dashboard', {
      title: 'Dashboard - GooseCorp Admin',
      user: req.user,
      ...dashboardData
    });

  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load dashboard' 
    });
  }
});

// Current visitors page
router.get('/current-visitors', authenticateWeb, async (req, res) => {
  try {
    const currentVisitors = await prisma.gooseCorpUser.findMany({
      where: { status: 'INSIDE' },
      include: {
        staff: true,
        formation: true,
        badge: true
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });

    res.render('admin/current-visitors', {
      title: 'Current Visitors - GooseCorp Admin',
      user: req.user,
      visitors: currentVisitors,
      count: currentVisitors.length
    });

  } catch (error) {
    console.error('Error loading current visitors:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load current visitors' 
    });
  }
});

// Visitors management page
router.get('/visitors', authenticateWeb, async (req, res) => {
  try {
    const { page = 1, search = '', status = '', visitReason = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (visitReason) {
      whereClause.visitReason = visitReason;
    }
    
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    const visitors = await prisma.gooseCorpUser.findMany({
      where: whereClause,
      include: {
        staff: true,
        formation: true,
        badge: true
      },
      orderBy: {
        checkInTime: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.gooseCorpUser.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/visitors', {
      title: 'Visitors Management - GooseCorp Admin',
      user: req.user,
      visitors,
      pagination: {
        page: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filters: { search, status, visitReason },
      totalCount
    });

  } catch (error) {
    console.error('Error loading visitors:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load visitors' 
    });
  }
});

// Staff management page
router.get('/staff', authenticateWeb, async (req, res) => {
  try {
    const { page = 1, search = '', department = '', isActive = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};
    
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }
    
    if (department) {
      whereClause.department = { contains: department, mode: 'insensitive' };
    }
    
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } }
      ];
    }

    const staff = await prisma.gooseCorpStaff.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            visitors: true,
            visits: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.gooseCorpStaff.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/staff', {
      title: 'Staff Management - GooseCorp Admin',
      user: req.user,
      staff,
      pagination: {
        page: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filters: { search, department, isActive },
      totalCount
    });

  } catch (error) {
    console.error('Error loading staff:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load staff' 
    });
  }
});

// Formations management page
router.get('/formations', authenticateWeb, async (req, res) => {
  try {
    const { page = 1, search = '', isActive = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};
    
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } }
      ];
    }

    const formations = await prisma.gooseCorpFormation.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            attendees: true,
            visits: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.gooseCorpFormation.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/formations', {
      title: 'Formations Management - GooseCorp Admin',
      user: req.user,
      formations,
      pagination: {
        page: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filters: { search, isActive },
      totalCount
    });

  } catch (error) {
    console.error('Error loading formations:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load formations' 
    });
  }
});

// Visit history page
router.get('/history', authenticateWeb, async (req, res) => {
  try {
    const { page = 1, date = '', search = '', action = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};
    
    if (date) {
      const selectedDate = new Date(date);
      const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      whereClause.timestamp = {
        gte: startOfDay,
        lt: endOfDay
      };
    }
    
    if (action) {
      whereClause.action = action;
    }
    
    if (search) {
      whereClause.visitor = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const visits = await prisma.visit.findMany({
      where: whereClause,
      include: {
        visitor: {
          include: {
            badge: true
          }
        },
        staff: true,
        formation: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.visit.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/history', {
      title: 'Visit History - GooseCorp Admin',
      user: req.user,
      visits,
      pagination: {
        page: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filters: { date, search, action },
      totalCount
    });

  } catch (error) {
    console.error('Error loading visit history:', error);
    res.render('admin/error', { 
      title: 'Error - GooseCorp Admin',
      error: 'Failed to load visit history' 
    });
  }
});

// Helper function to get dashboard data
async function getDashboardData() {
  // Get basic statistics
  const totalVisitors = await prisma.gooseCorpUser.count();
  const totalBadges = await prisma.badge.count();
  const activeBadges = await prisma.badge.count({
    where: {
      isActive: true,
      expiresAt: {
        gt: new Date()
      }
    }
  });
  const totalStaff = await prisma.gooseCorpStaff.count();
  const activeStaff = await prisma.gooseCorpStaff.count({
    where: { isActive: true }
  });
  const totalFormations = await prisma.gooseCorpFormation.count();
  const activeFormations = await prisma.gooseCorpFormation.count({
    where: { isActive: true }
  });

  // Get current visitors (inside building)
  const currentVisitors = await prisma.gooseCorpUser.findMany({
    where: { status: 'INSIDE' },
    include: {
      staff: true,
      formation: true,
      badge: true
    },
    orderBy: {
      checkInTime: 'desc'
    }
  });

  // Get today's statistics
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayVisitors = await prisma.gooseCorpUser.count({
    where: {
      checkInTime: {
        gte: startOfDay,
        lt: endOfDay
      }
    }
  });

  const todayCheckouts = await prisma.visit.count({
    where: {
      action: 'CHECK_OUT',
      timestamp: {
        gte: startOfDay,
        lt: endOfDay
      }
    }
  });

  return {
    statistics: {
      totalVisitors,
      totalBadges,
      activeBadges,
      totalStaff,
      activeStaff,
      totalFormations,
      activeFormations,
      currentVisitorsCount: currentVisitors.length,
      todayVisitors,
      todayCheckouts
    },
    currentVisitors: currentVisitors.slice(0, 10) // Limit for dashboard
  };
}

module.exports = router; 