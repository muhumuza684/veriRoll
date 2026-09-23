const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const sessionRouter = require('./sessions'); // mounts POST /:courseUnitId/sessions
const router = express.Router();

router.use('/', sessionRouter);

// GET /course-units/:id/sessions — lecturer's session history for a unit
router.get('/:id/sessions', requireAuth, requireRole('LECTURER', 'ADMIN'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const sessions = await prisma.session.findMany({
      where: { courseUnitId: req.params.id },
      orderBy: { lectureNumber: 'desc' },
    });
    res.json(sessions);
  } catch (e) { next(e); }
});

module.exports = router;
