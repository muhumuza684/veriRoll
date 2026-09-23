const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));

// POST /admin/course-units — { code, name, lessonsPlanned }
router.post('/course-units', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const unit = await prisma.courseUnit.create({ data: req.body });
    res.status(201).json(unit);
  } catch (e) { next(e); }
});

// POST /admin/course-units/:id/enrollments/sync
// Pulls the enrolled-student list from the school portal and reconciles it
// against VeriRoll's Enrollment table. This is the AUTHORITATIVE source —
// manual adds/removes below are the override layer on top of it, not a
// second parallel way of building the roster.
router.post('/course-units/:id/enrollments/sync', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const courseUnitId = req.params.id;

    // TODO: replace with a real portal integration — an API call if the
    // school exposes one, or a parsed CSV export otherwise.
    const portalStudentEmails = await fetchPortalRoster(courseUnitId);

    const created = [];
    for (const email of portalStudentEmails) {
      const student = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: email.split('@')[0], role: 'STUDENT', authProvider: 'GOOGLE', providerId: 'pending-first-login' },
      });
      const enr = await prisma.enrollment.upsert({
        where: { studentId_courseUnitId: { studentId: student.id, courseUnitId } },
        update: {},
        create: { studentId: student.id, courseUnitId, source: 'PORTAL' },
      });
      created.push(enr);
    }

    await prisma.auditLog.create({
      data: { actorId: req.user.userId, action: 'ENROLLMENT_SYNCED', targetType: 'CourseUnit', targetId: courseUnitId, detail: `${created.length} students synced` },
    });

    res.json({ synced: created.length });
  } catch (e) { next(e); }
});

// POST /admin/course-units/:id/enrollments — manual override add: { email, name }
router.post('/course-units/:id/enrollments', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { email, name } = req.body;
    const student = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: 'STUDENT', authProvider: 'GOOGLE', providerId: 'pending-first-login' },
    });
    const enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseUnitId: req.params.id, source: 'MANUAL' },
    });

    await prisma.auditLog.create({
      data: { actorId: req.user.userId, action: 'ENROLLMENT_MANUAL_ADD', targetType: 'Enrollment', targetId: enrollment.id },
    });

    res.status(201).json(enrollment);
  } catch (e) { next(e); }
});

// DELETE /admin/course-units/:id/enrollments/:studentId — manual override remove
router.delete('/course-units/:id/enrollments/:studentId', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    await prisma.enrollment.delete({
      where: { studentId_courseUnitId: { studentId: req.params.studentId, courseUnitId: req.params.id } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user.userId, action: 'ENROLLMENT_MANUAL_REMOVE', targetType: 'Enrollment', targetId: req.params.studentId },
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

// POST /admin/lecturers — { email, name, courseUnitId }
router.post('/lecturers', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { email, name, courseUnitId } = req.body;
    const lecturer = await prisma.user.upsert({
      where: { email },
      update: { role: 'LECTURER' },
      create: { email, name, role: 'LECTURER', authProvider: 'GOOGLE', providerId: 'pending-first-login' },
    });
    await prisma.courseUnit.update({
      where: { id: courseUnitId },
      data: { lecturers: { connect: { id: lecturer.id } } },
    });
    res.status(201).json(lecturer);
  } catch (e) { next(e); }
});

// GET /admin/audit-logs — full trail of manual edits, for dispute resolution
router.get('/audit-logs', async (req, res, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: true },
    });
    res.json(logs);
  } catch (e) { next(e); }
});

async function fetchPortalRoster(courseUnitId) {
  // Stub — wire this to the actual school portal (API or scheduled CSV drop).
  return [];
}

module.exports = router;
