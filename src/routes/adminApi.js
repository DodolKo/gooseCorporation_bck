const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const prisma = require('../config/database');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// =============================================================================
// API ROUTES (JSON responses)
// =============================================================================

// Admin login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log the login
    await prisma.log.create({
      data: {
        action: 'LOGIN',
        details: `Admin login: ${admin.email}`,
        adminId: admin.id
      }
    });

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get dashboard data (protected route)
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get basic statistics
    const totalVisitors = await prisma.gooseCorpUser.count();
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
        formation: true
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

    // Get recent visitors (last 10)
    const recentVisitors = await prisma.gooseCorpUser.findMany({
      take: 10,
      include: {
        staff: true,
        formation: true
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });



    // Get visit reason statistics
    const visitReasonStats = await prisma.gooseCorpUser.groupBy({
      by: ['visitReason'],
      _count: {
        id: true
      },
      where: {
        checkInTime: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    // Get most visited staff today
    const mostVisitedStaff = await prisma.gooseCorpStaff.findMany({
      include: {
        _count: {
          select: {
            visits: {
              where: {
                timestamp: {
                  gte: startOfDay,
                  lt: endOfDay
                }
              }
            }
          }
        }
      },
      orderBy: {
        visits: {
          _count: 'desc'
        }
      },
      take: 5
    });

    // Get upcoming formations
    const upcomingFormations = await prisma.gooseCorpFormation.findMany({
      where: {
        isActive: true,
        startDate: {
          gte: new Date()
        }
      },
      include: {
        _count: {
          select: {
            attendees: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      },
      take: 5
    });

    // Get hourly visitor distribution for today
    const hourlyStats = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const count = await prisma.gooseCorpUser.count({
        where: {
          checkInTime: {
            gte: hourStart,
            lt: hourEnd
          }
        }
      });
      
      hourlyStats.push({
        hour: hour.toString().padStart(2, '0') + ':00',
        count
      });
    }

    res.json({
      statistics: {
        totalVisitors,
        totalStaff,
        activeStaff,
        totalFormations,
        activeFormations,
        currentVisitorsCount: currentVisitors.length,
        todayVisitors,
        todayCheckouts
      },
      currentVisitors,
      recentVisitors,
      visitReasonStats,
      mostVisitedStaff,
      upcomingFormations,
      hourlyStats: hourlyStats.filter(stat => stat.count > 0) // Only show hours with activity
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get logs (protected route)
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const logs = await prisma.log.findMany({
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalLogs = await prisma.log.count();

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get all staff members
router.get('/staff', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, department, isActive } = req.query;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (department) {
      whereClause.department = { contains: department, mode: 'insensitive' };
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
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

    res.json({
      staff,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Get staff member by ID
router.get('/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await prisma.gooseCorpStaff.findUnique({
      where: { id: parseInt(id) },
      include: {
        visitors: {
          orderBy: { checkInTime: 'desc' },
          take: 10
        },
        visits: {
          include: {
            visitor: true
          },
          orderBy: { timestamp: 'desc' },
          take: 20
        },
        _count: {
          select: {
            visitors: true,
            visits: true
          }
        }
      }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ staff });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// Create staff member
router.post('/staff', [
  authenticateToken,
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/).withMessage('Valid phone number is required'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('office').optional().trim().isLength({ min: 2 }).withMessage('Office must be at least 2 characters'),
  body('position').optional().trim().isLength({ min: 2 }).withMessage('Position must be at least 2 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phone, department, office, position, isActive = true } = req.body;

    // Check if email already exists
    const existingStaff = await prisma.gooseCorpStaff.findUnique({
      where: { email }
    });

    if (existingStaff) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const staff = await prisma.gooseCorpStaff.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        department,
        office,
        position,
        isActive
      }
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: 'CREATE_STAFF',
        details: `Created staff member: ${firstName} ${lastName} (${email})`,
        adminId: req.user.userId
      }
    });

    res.status(201).json({
      message: 'Staff member created successfully',
      staff
    });

  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// Update staff member
router.put('/staff/:id', [
  authenticateToken,
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/).withMessage('Valid phone number is required'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('office').optional().trim().isLength({ min: 2 }).withMessage('Office must be at least 2 characters'),
  body('position').optional().trim().isLength({ min: 2 }).withMessage('Position must be at least 2 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { firstName, lastName, email, phone, department, office, position, isActive } = req.body;

    // Check if staff member exists
    const existingStaff = await prisma.gooseCorpStaff.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Check if email already exists for another staff member
    if (email !== existingStaff.email) {
      const emailExists = await prisma.gooseCorpStaff.findUnique({
        where: { email }
      });

      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const updatedStaff = await prisma.gooseCorpStaff.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        email,
        phone,
        department,
        office,
        position,
        isActive
      }
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: 'UPDATE_STAFF',
        details: `Updated staff member: ${firstName} ${lastName} (${email})`,
        adminId: req.user.userId
      }
    });

    res.json({
      message: 'Staff member updated successfully',
      staff: updatedStaff
    });

  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Delete staff member
router.delete('/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if staff member exists
    const existingStaff = await prisma.gooseCorpStaff.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            visitors: true,
            visits: true
          }
        }
      }
    });

    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Check if staff member has associated visitors or visits
    if (existingStaff._count.visitors > 0 || existingStaff._count.visits > 0) {
      // Soft delete by setting isActive to false
      const updatedStaff = await prisma.gooseCorpStaff.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });

      // Log the action
      await prisma.log.create({
        data: {
          action: 'DEACTIVATE_STAFF',
          details: `Deactivated staff member: ${existingStaff.firstName} ${existingStaff.lastName} (${existingStaff.email})`,
          adminId: req.user.userId
        }
      });

      res.json({
        message: 'Staff member deactivated successfully (has associated data)',
        staff: updatedStaff
      });
    } else {
      // Hard delete if no associated data
      await prisma.gooseCorpStaff.delete({
        where: { id: parseInt(id) }
      });

      // Log the action
      await prisma.log.create({
        data: {
          action: 'DELETE_STAFF',
          details: `Deleted staff member: ${existingStaff.firstName} ${existingStaff.lastName} (${existingStaff.email})`,
          adminId: req.user.userId
        }
      });

      res.json({ message: 'Staff member deleted successfully' });
    }

  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// Get all formations
router.get('/formations', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, isActive, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (startDate && endDate) {
      whereClause.startDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (startDate) {
      whereClause.startDate = {
        gte: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.startDate = {
        lte: new Date(endDate)
      };
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

    res.json({
      formations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching formations:', error);
    res.status(500).json({ error: 'Failed to fetch formations' });
  }
});

// Get formation by ID
router.get('/formations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const formation = await prisma.gooseCorpFormation.findUnique({
      where: { id: parseInt(id) },
      include: {
        attendees: {
          orderBy: { checkInTime: 'desc' }
        },
        visits: {
          include: {
            visitor: true
          },
          orderBy: { timestamp: 'desc' },
          take: 20
        },
        _count: {
          select: {
            attendees: true,
            visits: true
          }
        }
      }
    });

    if (!formation) {
      return res.status(404).json({ error: 'Formation not found' });
    }

    res.json({ formation });
  } catch (error) {
    console.error('Error fetching formation:', error);
    res.status(500).json({ error: 'Failed to fetch formation' });
  }
});

// Create formation
router.post('/formations', [
  authenticateToken,
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 2 }).withMessage('Description must be at least 2 characters'),
  body('location').trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('maxAttendees').optional().isInt({ min: 1 }).withMessage('Max attendees must be a positive number'),
  body('instructor').optional().trim().isLength({ min: 2 }).withMessage('Instructor must be at least 2 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, startDate, endDate, maxAttendees, instructor, isActive = true } = req.body;

    // Validate date range
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const formation = await prisma.gooseCorpFormation.create({
      data: {
        name,
        description,
        location,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        instructor,
        isActive
      }
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: 'CREATE_FORMATION',
        details: `Created formation: ${name} at ${location}`,
        adminId: req.user.userId
      }
    });

    res.status(201).json({
      message: 'Formation created successfully',
      formation
    });

  } catch (error) {
    console.error('Error creating formation:', error);
    res.status(500).json({ error: 'Failed to create formation' });
  }
});

// Update formation
router.put('/formations/:id', [
  authenticateToken,
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 2 }).withMessage('Description must be at least 2 characters'),
  body('location').trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('maxAttendees').optional().isInt({ min: 1 }).withMessage('Max attendees must be a positive number'),
  body('instructor').optional().trim().isLength({ min: 2 }).withMessage('Instructor must be at least 2 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, location, startDate, endDate, maxAttendees, instructor, isActive } = req.body;

    // Check if formation exists
    const existingFormation = await prisma.gooseCorpFormation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingFormation) {
      return res.status(404).json({ error: 'Formation not found' });
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const updatedFormation = await prisma.gooseCorpFormation.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        location,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        instructor,
        isActive
      }
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: 'UPDATE_FORMATION',
        details: `Updated formation: ${name} at ${location}`,
        adminId: req.user.userId
      }
    });

    res.json({
      message: 'Formation updated successfully',
      formation: updatedFormation
    });

  } catch (error) {
    console.error('Error updating formation:', error);
    res.status(500).json({ error: 'Failed to update formation' });
  }
});

// Delete formation
router.delete('/formations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if formation exists
    const existingFormation = await prisma.gooseCorpFormation.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            attendees: true,
            visits: true
          }
        }
      }
    });

    if (!existingFormation) {
      return res.status(404).json({ error: 'Formation not found' });
    }

    // Check if formation has associated attendees or visits
    if (existingFormation._count.attendees > 0 || existingFormation._count.visits > 0) {
      // Soft delete by setting isActive to false
      const updatedFormation = await prisma.gooseCorpFormation.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });

      // Log the action
      await prisma.log.create({
        data: {
          action: 'DEACTIVATE_FORMATION',
          details: `Deactivated formation: ${existingFormation.name} at ${existingFormation.location}`,
          adminId: req.user.userId
        }
      });

      res.json({
        message: 'Formation deactivated successfully (has associated data)',
        formation: updatedFormation
      });
    } else {
      // Hard delete if no associated data
      await prisma.gooseCorpFormation.delete({
        where: { id: parseInt(id) }
      });

      // Log the action
      await prisma.log.create({
        data: {
          action: 'DELETE_FORMATION',
          details: `Deleted formation: ${existingFormation.name} at ${existingFormation.location}`,
          adminId: req.user.userId
        }
      });

      res.json({ message: 'Formation deleted successfully' });
    }

  } catch (error) {
    console.error('Error deleting formation:', error);
    res.status(500).json({ error: 'Failed to delete formation' });
  }
});

// Get visit history with filtering
router.get('/history', [
  authenticateToken,
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  query('date').optional().isISO8601().withMessage('Valid date is required'),
  query('visitReason').optional().isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']).withMessage('Invalid visit reason'),
  query('staffId').optional().isInt().withMessage('Staff ID must be a number'),
  query('formationId').optional().isInt().withMessage('Formation ID must be a number'),
  query('action').optional().isIn(['CHECK_IN', 'CHECK_OUT', 'RETURN']).withMessage('Invalid action'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term too short')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      startDate, 
      endDate, 
      date, 
      visitReason, 
      staffId, 
      formationId, 
      action, 
      search,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build where clause for visits
    let whereClause = {};

    // Date filtering
    if (date) {
      const selectedDate = new Date(date);
      const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      whereClause.timestamp = {
        gte: startOfDay,
        lt: endOfDay
      };
    } else if (startDate && endDate) {
      whereClause.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (startDate) {
      whereClause.timestamp = {
        gte: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.timestamp = {
        lte: new Date(endDate)
      };
    }

    // Other filters
    if (action) {
      whereClause.action = action;
    }

    if (staffId) {
      whereClause.staffId = parseInt(staffId);
    }

    if (formationId) {
      whereClause.formationId = parseInt(formationId);
    }

    // Visitor-based filters
    let visitorWhereClause = {};
    
    if (visitReason) {
      visitorWhereClause.visitReason = visitReason;
    }

    if (search) {
      visitorWhereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Apply visitor filters if any
    if (Object.keys(visitorWhereClause).length > 0) {
      whereClause.visitor = visitorWhereClause;
    }

    // Get visits with full details
    const visits = await prisma.visit.findMany({
      where: whereClause,
      include: {
        visitor: true,
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

    // Get summary statistics for the filtered period
    const summaryStats = await prisma.visit.groupBy({
      by: ['action'],
      _count: {
        id: true
      },
      where: whereClause
    });

    // Get daily statistics for the filtered period
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date,
        action,
        COUNT(*) as count
      FROM "Visit"
      WHERE timestamp >= ${whereClause.timestamp?.gte || new Date('1970-01-01')}
        AND timestamp <= ${whereClause.timestamp?.lte || new Date()}
      GROUP BY DATE(timestamp), action
      ORDER BY date DESC
    `;

    res.json({
      visits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalVisits: totalCount,
        actionBreakdown: summaryStats,
        dailyStats
      }
    });

  } catch (error) {
    console.error('Error fetching visit history:', error);
    res.status(500).json({ error: 'Failed to fetch visit history' });
  }
});

// Get visitor history by visitor ID or uniqueId
router.get('/history/visitor/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Find visitor
    let visitor = null;
    if (!isNaN(identifier)) {
      visitor = await prisma.gooseCorpUser.findUnique({ where: { id: parseInt(identifier) } });
    } else {
      visitor = await prisma.gooseCorpUser.findUnique({ where: { uniqueId: identifier } });
    }

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Get visitor's visit history
    const visits = await prisma.visit.findMany({
      where: { visitorId: visitor.id },
      include: {
        staff: true,
        formation: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.visit.count({ where: { visitorId: visitor.id } });

    res.json({
      visitor: {
        id: visitor.id,
        uniqueId: visitor.uniqueId,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        email: visitor.email,
        status: visitor.status
      },
      visits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching visitor history:', error);
    res.status(500).json({ error: 'Failed to fetch visitor history' });
  }
});

module.exports = router; 