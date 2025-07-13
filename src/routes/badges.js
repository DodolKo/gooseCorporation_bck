const express = require('express');
const router = express.Router();
const prisma = require('../config/database');

// Generate badge ID (soft ID like GC-2024-001)
function generateBadgeId() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `GC-${year}-${random}`;
}

// Generate a badge for a visitor
router.post('/generate/:visitorId', async (req, res) => {
  try {
    const { visitorId } = req.params;

    // Check if visitor exists
    const visitor = await prisma.gooseCorpUser.findUnique({
      where: { id: parseInt(visitorId) },
      include: {
        staff: true,
        formation: true,
        badge: true
      }
    });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Check if badge already exists
    if (visitor.badge) {
      return res.status(400).json({ error: 'Badge already exists for this visitor' });
    }

    // Generate badge
    const badgeId = generateBadgeId();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // Expires in 8 hours

    const badge = await prisma.badge.create({
      data: {
        badgeId,
        visitorId: parseInt(visitorId),
        expiresAt
      }
    });

    // Get updated visitor with badge
    const updatedVisitor = await prisma.gooseCorpUser.findUnique({
      where: { id: parseInt(visitorId) },
      include: {
        staff: true,
        formation: true,
        badge: true
      }
    });

    res.status(201).json({
      message: 'Badge generated successfully',
      badge,
      visitor: updatedVisitor
    });

  } catch (error) {
    console.error('Error generating badge:', error);
    res.status(500).json({ error: 'Failed to generate badge' });
  }
});

// Verify a badge by ID
router.get('/verify/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;

    const badge = await prisma.badge.findUnique({
      where: { badgeId },
      include: {
        visitor: {
          include: {
            staff: true,
            formation: true
          }
        }
      }
    });

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    // Check if badge is expired
    if (new Date() > badge.expiresAt) {
      return res.status(400).json({ 
        error: 'Badge expired',
        badge: badge,
        expired: true
      });
    }

    // Check if badge is active
    if (!badge.isActive) {
      return res.status(400).json({ 
        error: 'Badge is inactive',
        badge: badge,
        inactive: true
      });
    }

    res.json({
      message: 'Badge is valid',
      badge: badge,
      valid: true
    });

  } catch (error) {
    console.error('Error verifying badge:', error);
    res.status(500).json({ error: 'Failed to verify badge' });
  }
});

// Get all badges
router.get('/', async (req, res) => {
  try {
    const badges = await prisma.badge.findMany({
      include: {
        visitor: {
          include: {
            staff: true,
            formation: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Deactivate a badge
router.patch('/deactivate/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;

    const badge = await prisma.badge.update({
      where: { badgeId },
      data: { isActive: false }
    });

    res.json({
      message: 'Badge deactivated successfully',
      badge
    });

  } catch (error) {
    console.error('Error deactivating badge:', error);
    res.status(500).json({ error: 'Failed to deactivate badge' });
  }
});

module.exports = router; 