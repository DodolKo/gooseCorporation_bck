const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const prisma = require('../config/database');

// Validation rules
const visitorValidation = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
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

    // Create visitor
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
        badge: true,
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
          badge: true,
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
          badge: true,
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
        badge: true
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
    await prisma.badge.deleteMany({ where: { visitorId: visitor.id } });
    
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
        badge: true
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

    // Deactivate badge if exists
    if (visitor.badge) {
      await prisma.badge.update({
        where: { id: visitor.badge.id },
        data: { isActive: false }
      });
    }

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
        badge: true
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
        badge: true,
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
        badge: true
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

module.exports = router; 