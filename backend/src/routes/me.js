const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /me/course-units
// Returns every unit the student is enrolled in (auto-populated from the
// portal sync — see routes/admin.js) with attendance stats computed
// against lessons HELD SO FAR, not the full semester total. A lesson
// that hasn't happened yet is not counted as absent.
router.get('/course-units', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.userId },
      include: { courseUnit: true },
    });

    const results = await Promise.all(
      enrollments.map(async (enr) => {
        const heldSessions = await prisma.session.count({
          where: { courseUnitId: enr.courseUnitId, status: 'CLOSED' },
        });
        const presentCount = await prisma.attendanceRecord.count({
          where: {
            studentId: req.user.userId,
            status: 'PRESENT',
            session: { courseUnitId: enr.courseUnitId, status: 'CLOSED' },
          },
        });
        const percentage = heldSessions === 0 ? null : Math.round((presentCount / heldSessions) * 100);

        // Is there a session open right now for this unit?
        const openSession = await prisma.session.findFirst({
          where: { courseUnitId: enr.courseUnitId, status: 'OPEN' },
        });

        return {
          courseUnit: { id: enr.courseUnit.id, code: enr.courseUnit.code, name: enr.courseUnit.name },
          heldSoFar: heldSessions,
          lessonsPlanned: enr.courseUnit.lessonsPlanned,
          present: presentCount,
          absent: heldSessions - presentCount,
          percentage, // null until the first lecture has been held
          openSessionId: openSession ? openSession.id : null,
        };
      })
    );

    res.json(results);
  } catch (e) { next(e); }
});

module.exports = router;
