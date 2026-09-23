const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const courseUnitRoutes = require('./routes/courseUnits');
const sessionRoutes = require('./routes/sessions');
const meRoutes = require('./routes/me');
const adminRoutes = require('./routes/admin');
const { startAutoCloseJob } = require('./lib/sessionLifecycle');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.locals.prisma = prisma;

app.use('/auth', authRoutes);
app.use('/course-units', courseUnitRoutes);
app.use('/sessions', sessionRoutes);
app.use('/me', meRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`VeriRoll API listening on :${PORT}`);
  // Background job: closes any session whose autoCloseAt has passed,
  // even if the lecturer never taps Stop.
  startAutoCloseJob(prisma);
});
