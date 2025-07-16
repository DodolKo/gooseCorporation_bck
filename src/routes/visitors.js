const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const prisma = require('../config/database');

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Visitors routes are working!', timestamp: new Date().toISOString() });
});

// Validation rules
const visitorValidation = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/).withMessage('Valid phone number is required'),
  body('company').optional().trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
  body('visitReason').isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']).withMessage('Invalid visit reason'),
  body('staffId').optional().isInt().withMessage('Staff ID must be a number'),
  body('formationId').optional().isInt().withMessage('Formation ID must be a number')
];

// Register a new visitor
router.post('/', visitorValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phone, company, visitReason, staffId, formationId } = req.body;

    // Validate that either staffId or formationId is provided based on visitReason
    if (visitReason === 'MEETING' && !staffId) {
      return res.status(400).json({ error: 'Staff ID is required for meetings' });
    }
    if (visitReason === 'FORMATION' && !formationId) {
      return res.status(400).json({ error: 'Formation ID is required for formations' });
    }

    // Check if staff exists
    if (staffId) {
      const staff = await prisma.gooseCorpStaff.findUnique({
        where: { id: staffId, isActive: true }
      });
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found or inactive' });
      }
    }

    // Check if formation exists
    if (formationId) {
      const formation = await prisma.gooseCorpFormation.findUnique({
        where: { id: formationId, isActive: true }
      });
      if (!formation) {
        return res.status(404).json({ error: 'Formation not found or inactive' });
      }
    }

    // Check if visitor already exists and is currently inside
    const existingVisitor = await prisma.gooseCorpUser.findFirst({
      where: {
        email: email,
        status: 'INSIDE'
      }
    });

    if (existingVisitor) {
      return res.status(400).json({ 
        error: 'Un visiteur avec cet email est déjà enregistré comme présent dans le bâtiment',
        suggestion: 'Veuillez d\'abord effectuer la sortie ou utiliser un autre email'
      });
    }

    // Create visitor (allow duplicate emails for different visits)
    const visitor = await prisma.gooseCorpUser.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        visitReason,
        staffId: visitReason === 'MEETING' ? staffId : null,
        formationId: visitReason === 'FORMATION' ? formationId : null,
        status: 'INSIDE',
        checkInTime: new Date()
      },
      include: {
        staff: true,
        formation: true
      }
    });

    // Create visit history entry
    await prisma.visit.create({
      data: {
        visitorId: visitor.id,
        action: 'CHECK_IN',
        timestamp: visitor.checkInTime,
        details: `Initial check-in for ${visitReason}`,
        staffId: visitor.staffId,
        formationId: visitor.formationId
      }
    });

    res.status(201).json({
      message: 'Visitor registered successfully',
      visitor: {
        ...visitor,
        uniqueId: visitor.uniqueId // Return the unique ID for future reference
      }
    });

  } catch (error) {
    console.error('Error registering visitor:', error);
    res.status(500).json({ error: 'Failed to register visitor' });
  }
});

// Get all visitors with optional filters
router.get('/', [
  query('status').optional().isIn(['INSIDE', 'OUTSIDE']).withMessage('Invalid status'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term too short'),
  query('visitReason').optional().isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']).withMessage('Invalid visit reason')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, date, search, visitReason, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (visitReason) {
      whereClause.visitReason = visitReason;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      whereClause.checkInTime = {
        gte: startDate,
        lt: endDate
      };
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
        visits: {
          orderBy: { timestamp: 'desc' },
          take: 5
        }
      },
      orderBy: {
        checkInTime: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalCount = await prisma.gooseCorpUser.count({ where: whereClause });

    res.json({
      visitors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching visitors:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

// Get visitor by ID or uniqueId
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by uniqueId
    let visitor = null;
    
    if (!isNaN(identifier)) {
      visitor = await prisma.gooseCorpUser.findUnique({
        where: { id: parseInt(identifier) },
        include: {
          staff: true,
          formation: true,
          visits: {
            orderBy: { timestamp: 'desc' },
            include: {
              staff: true,
              formation: true
            }
          }
        }
      });
    }
    
    if (!visitor) {
      visitor = await prisma.gooseCorpUser.findUnique({
        where: { uniqueId: identifier },
        include: {
          staff: true,
          formation: true,
          visits: {
            orderBy: { timestamp: 'desc' },
            include: {
              staff: true,
              formation: true
            }
          }
        }
      });
    }

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    res.json(visitor);
  } catch (error) {
    console.error('Error fetching visitor:', error);
    res.status(500).json({ error: 'Failed to fetch visitor' });
  }
});

// Update visitor
router.put('/:identifier', visitorValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.params;
    const { firstName, lastName, email, phone, company, visitReason, staffId, formationId } = req.body;

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

    // Validate staff and formation if provided
    if (staffId) {
      const staff = await prisma.gooseCorpStaff.findUnique({
        where: { id: staffId, isActive: true }
      });
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found or inactive' });
      }
    }

    if (formationId) {
      const formation = await prisma.gooseCorpFormation.findUnique({
        where: { id: formationId, isActive: true }
      });
      if (!formation) {
        return res.status(404).json({ error: 'Formation not found or inactive' });
      }
    }

    // Update visitor
    const updatedVisitor = await prisma.gooseCorpUser.update({
      where: { id: visitor.id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        visitReason,
        staffId: visitReason === 'MEETING' ? staffId : null,
        formationId: visitReason === 'FORMATION' ? formationId : null
      },
      include: {
        staff: true,
        formation: true,
      }
    });

    res.json({
      message: 'Visitor updated successfully',
      visitor: updatedVisitor
    });

  } catch (error) {
    console.error('Error updating visitor:', error);
    res.status(500).json({ error: 'Failed to update visitor' });
  }
});

// Delete visitor
router.delete('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

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

    // Delete related records first
    await prisma.visit.deleteMany({ where: { visitorId: visitor.id } });
    
    // Delete visitor
    await prisma.gooseCorpUser.delete({ where: { id: visitor.id } });

    res.json({ message: 'Visitor deleted successfully' });

  } catch (error) {
    console.error('Error deleting visitor:', error);
    res.status(500).json({ error: 'Failed to delete visitor' });
  }
});

// Check out visitor
router.post('/:identifier/checkout', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('[DEBUG] Checkout request for visitor:', identifier);
    console.log('[DEBUG] Headers:', req.headers);
    console.log('[DEBUG] Body:', req.body);

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

    if (visitor.status === 'OUTSIDE') {
      console.log('[DEBUG] Visitor already checked out:', identifier);
      return res.status(400).json({ error: 'Visitor is already checked out' });
    }

    // Update visitor status
    const updatedVisitor = await prisma.gooseCorpUser.update({
      where: { id: visitor.id },
      data: {
        status: 'OUTSIDE',
        checkOutTime: new Date()
      },
      include: {
        staff: true,
        formation: true,
      }
    });

    // Create visit history entry
    await prisma.visit.create({
      data: {
        visitorId: visitor.id,
        action: 'CHECK_OUT',
        timestamp: updatedVisitor.checkOutTime,
        details: 'Visitor checked out',
        staffId: visitor.staffId,
        formationId: visitor.formationId
      }
    });

    console.log('[DEBUG] Checkout successful for visitor:', updatedVisitor.id);
    res.json({
      message: 'Visitor checked out successfully',
      visitor: updatedVisitor
    });

  } catch (error) {
    console.error('Error checking out visitor:', error);
    res.status(500).json({ error: 'Failed to check out visitor' });
  }
});

// Return visitor (check back in)
router.post('/:identifier/return', [
  body('visitReason').isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']).withMessage('Invalid visit reason'),
  body('staffId').optional().isInt().withMessage('Staff ID must be a number'),
  body('formationId').optional().isInt().withMessage('Formation ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.params;
    const { visitReason, staffId, formationId } = req.body;

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

    if (visitor.status === 'INSIDE') {
      return res.status(400).json({ error: 'Visitor is already inside' });
    }

    // Validate staff and formation if provided
    if (visitReason === 'MEETING' && !staffId) {
      return res.status(400).json({ error: 'Staff ID is required for meetings' });
    }
    if (visitReason === 'FORMATION' && !formationId) {
      return res.status(400).json({ error: 'Formation ID is required for formations' });
    }

    // Update visitor status
    const updatedVisitor = await prisma.gooseCorpUser.update({
      where: { id: visitor.id },
      data: {
        status: 'INSIDE',
        visitReason,
        staffId: visitReason === 'MEETING' ? staffId : null,
        formationId: visitReason === 'FORMATION' ? formationId : null,
        checkInTime: new Date(),
        checkOutTime: null
      },
      include: {
        staff: true,
        formation: true,
      }
    });

    // Create visit history entry
    await prisma.visit.create({
      data: {
        visitorId: visitor.id,
        action: 'RETURN',
        timestamp: updatedVisitor.checkInTime,
        details: `Visitor returned for ${visitReason}`,
        staffId: updatedVisitor.staffId,
        formationId: updatedVisitor.formationId
      }
    });

    res.json({
      message: 'Visitor returned successfully',
      visitor: updatedVisitor
    });

  } catch (error) {
    console.error('Error returning visitor:', error);
    res.status(500).json({ error: 'Failed to return visitor' });
  }
});

// Search visitor by email
router.get('/search/email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const visitors = await prisma.gooseCorpUser.findMany({
      where: {
        email: {
          contains: email,
          mode: 'insensitive'
        }
      },
      include: {
        staff: true,
        formation: true,
        visits: {
          orderBy: { timestamp: 'desc' },
          take: 5
        }
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });

    res.json(visitors);

  } catch (error) {
    console.error('Error searching visitor by email:', error);
    res.status(500).json({ error: 'Failed to search visitor' });
  }
});

// Get current visitors (inside building)
router.get('/status/inside', async (req, res) => {
  try {
    const visitors = await prisma.gooseCorpUser.findMany({
      where: { status: 'INSIDE' },
      include: {
        staff: true,
        formation: true,
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });

    res.json({
      count: visitors.length,
      visitors
    });

  } catch (error) {
    console.error('Error fetching current visitors:', error);
    res.status(500).json({ error: 'Failed to fetch current visitors' });
  }
});

// Check visitor status endpoint
router.get('/:identifier/status', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('[DEBUG] Status check request for visitor:', identifier);

    // Find visitor by ID or uniqueId
    let visitor = null;
    if (!isNaN(identifier)) {
      visitor = await prisma.gooseCorpUser.findUnique({ 
        where: { id: parseInt(identifier) },
        include: { 
          staff: true, 
          formation: true, 
          visits: {
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        }
      });
    } else {
      visitor = await prisma.gooseCorpUser.findUnique({ 
        where: { uniqueId: identifier },
        include: { 
          staff: true, 
          formation: true, 
          visits: {
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        }
      });
    }

    if (!visitor) {
      return res.status(404).json({ 
        error: 'Visitor not found',
        exists: false
      });
    }

    // Calculate visit duration if inside
    let visitDuration = null;
    if (visitor.status === 'INSIDE' && visitor.checkInTime) {
      const now = new Date();
      const checkInTime = new Date(visitor.checkInTime);
      const diffMs = now - checkInTime;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      visitDuration = `${diffHours}h ${diffMinutes}m`;
    }

    res.json({
      exists: true,
      visitor: {
        id: visitor.id,
        uniqueId: visitor.uniqueId,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        email: visitor.email,
        status: visitor.status,
        visitReason: visitor.visitReason,
        checkInTime: visitor.checkInTime,
        checkOutTime: visitor.checkOutTime,
        visitDuration,
        staff: visitor.staff,
        formation: visitor.formation,
        lastVisit: visitor.visits[0] || null
      }
    });

  } catch (error) {
    console.error('Error checking visitor status:', error);
    res.status(500).json({ error: 'Failed to check visitor status' });
  }
});

// Re-entry endpoint for existing visitors
router.post('/:identifier/reentry', [
  body('visitReason').isIn(['MEETING', 'FORMATION', 'OTHER', 'DELIVERY', 'MAINTENANCE']).withMessage('Invalid visit reason'),
  body('staffId').optional().isInt().withMessage('Staff ID must be a number'),
  body('formationId').optional().isInt().withMessage('Formation ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.params;
    const { visitReason, staffId, formationId } = req.body;

    // Find visitor by ID or uniqueId
    let visitor = null;
    if (!isNaN(identifier)) {
      visitor = await prisma.gooseCorpUser.findUnique({ 
        where: { id: parseInt(identifier) },
        include: { staff: true, formation: true }
      });
    } else {
      visitor = await prisma.gooseCorpUser.findUnique({ 
        where: { uniqueId: identifier },
        include: { staff: true, formation: true }
      });
    }

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    if (visitor.status === 'INSIDE') {
      return res.status(400).json({ error: 'Visitor is already inside the building' });
    }

    // Validate staff/formation requirements
    if (visitReason === 'MEETING' && !staffId) {
      return res.status(400).json({ error: 'Staff ID is required for meetings' });
    }
    if (visitReason === 'FORMATION' && !formationId) {
      return res.status(400).json({ error: 'Formation ID is required for formations' });
    }

    // Validate staff exists if provided
    if (staffId) {
      const staff = await prisma.gooseCorpStaff.findUnique({
        where: { id: staffId, isActive: true }
      });
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found or inactive' });
      }
    }

    // Validate formation exists if provided
    if (formationId) {
      const formation = await prisma.gooseCorpFormation.findUnique({
        where: { id: formationId, isActive: true }
      });
      if (!formation) {
        return res.status(404).json({ error: 'Formation not found or inactive' });
      }
    }

    // Update visitor status and info
    const updatedVisitor = await prisma.gooseCorpUser.update({
      where: { id: visitor.id },
      data: {
        status: 'INSIDE',
        checkInTime: new Date(),
        checkOutTime: null,
        visitReason: visitReason,
        staffId: staffId || null,
        formationId: formationId || null
      },
      include: {
        staff: true,
        formation: true,
      }
    });

    // Create visit history entry
    await prisma.visit.create({
      data: {
        visitorId: visitor.id,
        action: 'RETURN',
        timestamp: updatedVisitor.checkInTime,
        details: `Re-entry for ${visitReason}`,
        staffId: staffId || null,
        formationId: formationId || null
      }
    });



    res.json({
      message: 'Visitor re-entry successful',
      visitor: {
        ...updatedVisitor,
        isReentry: true
      }
    });

  } catch (error) {
    console.error('Error processing re-entry:', error);
    res.status(500).json({ error: 'Failed to process re-entry' });
  }
});

// ========================================
// PUBLIC ENDPOINTS FOR FRONTEND
// ========================================

// Get active staff members (public endpoint)
router.get('/public/staff', async (req, res) => {
  try {
    // Add security headers for public endpoints
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    const staff = await prisma.gooseCorpStaff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        email: true
      },
      orderBy: [
        { department: 'asc' },
        { firstName: 'asc' }
      ]
    });

    res.json({ 
      staff,
      count: staff.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching public staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// Get active formations (public endpoint)
router.get('/public/formations', async (req, res) => {
  try {
    // Add security headers for public endpoints
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    const formations = await prisma.gooseCorpFormation.findMany({
      where: { 
        isActive: true
        // Removed date filter to show all active formations
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        instructor: true,
        maxAttendees: true,
        isActive: true
      },
      orderBy: { startDate: 'asc' }
    });

    res.json({ 
      formations,
      count: formations.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching public formations:', error);
    res.status(500).json({ error: 'Failed to fetch formations' });
  }
});

// Health check endpoint for frontend
router.get('/public/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});



// Check out visitor using uniqueId
router.post('/checkout/unique/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    console.log('[DEBUG] Checkout request with uniqueId:', uniqueId);
    console.log('[DEBUG] Headers:', req.headers);
    console.log('[DEBUG] Body:', req.body);

    // Find the visitor by uniqueId
    const visitor = await prisma.gooseCorpUser.findUnique({
      where: { uniqueId },
      include: {
        staff: true,
        formation: true,
      }
    });

    if (!visitor) {
      return res.status(404).json({ error: 'Visiteur non trouvé. Vérifiez votre ID.' });
    }

    if (visitor.status === 'OUTSIDE') {
      console.log('[DEBUG] Visitor already checked out:', visitor.uniqueId);
      return res.status(400).json({ error: 'Le visiteur est déjà sorti du bâtiment.' });
    }

    // Update visitor status
    const updatedVisitor = await prisma.gooseCorpUser.update({
      where: { uniqueId: visitor.uniqueId },
      data: {
        status: 'OUTSIDE',
        checkOutTime: new Date()
      },
      include: {
        staff: true,
        formation: true
      }
    });

    // Create visit history entry
    await prisma.visit.create({
      data: {
        visitorId: visitor.id,
        action: 'CHECK_OUT',
        timestamp: updatedVisitor.checkOutTime,
        details: 'Visitor checked out using uniqueId',
        staffId: visitor.staffId,
        formationId: visitor.formationId
      }
    });

    console.log('[DEBUG] Checkout successful for visitor:', updatedVisitor.uniqueId);
    res.json({
      message: 'Sortie effectuée avec succès',
      visitor: updatedVisitor
    });

  } catch (error) {
    console.error('Error checking out visitor with uniqueId:', error);
    res.status(500).json({ error: 'Erreur lors de la sortie du visiteur' });
  }
});

module.exports = router; 