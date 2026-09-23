const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

const AUTO_CLOSE_MINUTES = 20;

// POST /course-units/:id/sessions  (mounted below on courseUnitId param)
// Lecturer starts a session. Enforces: only one OPEN session per unit.
router.post(
  '/course-units/:courseUnitId/sessions',
  requireAuth,
  requireRole('LECTURER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const prisma = req.app.locals.prisma;
      const { courseUnitId } = req.params;

      const existingOpen = await prisma.session.findFirst({
        where: { courseUnitId, status: 'OPEN' },
      });
      if (existingOpen) {
        return res.status(409).json({ error: 'A session is already open for this unit', sessionId: existingOpen.id });
      }

      const lastSession = await prisma.session.findFirst({
        where: { courseUnitId },
        orderBy: { lectureNumber: 'desc' },
      });
      const lectureNumber = lastSession ? lastSession.lectureNumber + 1 : 1;

      const now = new Date();
      const session = await prisma.session.create({
        data: {
          courseUnitId,
          lectureNumber,
          status: 'OPEN',
          openedAt: now,
          autoCloseAt: new Date(now.getTime() + AUTO_CLOSE_MINUTES * 60 * 1000),
        },
      });

      await prisma.auditLog.create({
        data: { actorId: req.user.userId, action: 'SESSION_STARTED', targetType: 'Session', targetId: session.id },
      });

      res.status(201).json(session);
    } catch (e) { next(e); }
  }
);

// PATCH /sessions/:id/close
// Lecturer stops a session early. (Auto-close handles the case where they forget — see lib/sessionLifecycle.js.)
router.patch('/:id/close', requireAuth, requireRole('LECTURER', 'ADMIN'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const session = await closeSession(prisma, req.params.id, req.user.userId, 'SESSION_STOPPED_MANUALLY');
    res.json(session);
  } catch (e) { next(e); }
});

async function closeSession(prisma, sessionId, actorId, actionLabel) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status === 'CLOSED') return session;

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  // Anyone enrolled who never registered gets an explicit AUTO_ABSENT record,
  // so "held so far" percentages (see routes/me.js) have something to divide against.
  const enrolled = await prisma.enrollment.findMany({ where: { courseUnitId: session.courseUnitId } });
  const already = await prisma.attendanceRecord.findMany({ where: { sessionId }, select: { studentId: true } });
  const coveredIds = new Set(already.map((a) => a.studentId));
  const missing = enrolled.filter((e) => !coveredIds.has(e.studentId));

  if (missing.length) {
    await prisma.attendanceRecord.createMany({
      data: missing.map((e) => ({
        sessionId,
        studentId: e.studentId,
        status: 'ABSENT',
        method: 'AUTO_ABSENT',
      })),
    });
  }

  await prisma.auditLog.create({
    data: { actorId, action: actionLabel, targetType: 'Session', targetId: sessionId },
  });

  return updated;
}

// POST /sessions/:id/register
// Student self-check-in. Only works while the session is OPEN and the
// student is actually enrolled — this is the identity-confirmation step
// (Google/Microsoft sign-in already happened via /auth; this call just
// requires a valid, current token).
router.post('/:id/register', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.status !== 'OPEN') {
      return res.status(400).json({ error: 'This session is not open for registration' });
    }

    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseUnitId: { studentId: req.user.userId, courseUnitId: session.courseUnitId } },
    });
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this course unit' });

    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user.userId } },
      update: {},
      create: { sessionId: session.id, studentId: req.user.userId, status: 'PRESENT', method: 'SELF' },
    });

    res.json(record);
  } catch (e) { next(e); }
});

// GET /sessions/:id/roster — live roster for the lecturer dashboard
router.get('/:id/roster', requireAuth, requireRole('LECTURER', 'ADMIN'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId: req.params.id },
      include: { student: true, editedBy: true },
    });
    res.json(records);
  } catch (e) { next(e); }
});

// PATCH /sessions/:id/roster/:studentId
// The retroactive-fix endpoint: works whether the session is open OR
// closed, so a lecturer can act on a "sorry I forgot to register" email
// days later. Every use is logged with who/when.
router.patch('/:id/roster/:studentId', requireAuth, requireRole('LECTURER', 'ADMIN'), async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { status } = req.body; // 'PRESENT' | 'ABSENT'
    if (!['PRESENT', 'ABSENT'].includes(status)) {
      return res.status(400).json({ error: 'status must be PRESENT or ABSENT' });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: req.params.id, studentId: req.params.studentId } },
      update: { status, method: 'MANUAL', editedById: req.user.userId, editedAt: new Date() },
      create: {
        sessionId: req.params.id,
        studentId: req.params.studentId,
        status,
        method: 'MANUAL',
        editedById: req.user.userId,
        editedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        action: 'ATTENDANCE_CORRECTED',
        targetType: 'AttendanceRecord',
        targetId: record.id,
        detail: `set to ${status}`,
      },
    });

    res.json(record);
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.closeSession = closeSession;
