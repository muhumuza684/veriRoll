const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

// Runs regardless of whether the lecturer remembers to tap Stop.
// A session past its autoCloseAt gets closed the same way a manual
// stop does — same AUTO_ABSENT backfill, same audit trail — just
// with actorId null-safe handling since no user triggered it.
function startAutoCloseJob(prisma) {
  setInterval(async () => {
    const overdue = await prisma.session.findMany({
      where: { status: 'OPEN', autoCloseAt: { lt: new Date() } },
    });

    for (const session of overdue) {
      const { closeSession } = require('../routes/sessions');
      try {
        // System-initiated close: no human actor, so we log against
        // the course unit's assigned lecturer for traceability instead
        // of leaving actorId blank.
        const unit = await prisma.courseUnit.findUnique({
          where: { id: session.courseUnitId },
          include: { lecturers: true },
        });
        const actorId = unit?.lecturers?.[0]?.id;
        if (actorId) {
          await closeSession(prisma, session.id, actorId, 'SESSION_AUTO_CLOSED');
        }
      } catch (e) {
        console.error(`Auto-close failed for session ${session.id}:`, e.message);
      }
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startAutoCloseJob };
