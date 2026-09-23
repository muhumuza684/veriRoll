const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken, verifyMicrosoftToken } = require('../middleware/auth');

const router = express.Router();

// Student/lecturer signs in once; VeriRoll issues its own short-lived JWT.
// This is the login that persists across sessions — it is NOT the thing
// gated by "has the lecturer started the lecture". Registering for a
// specific session is a separate, later action (see routes/sessions.js).
async function signIn(req, res, provider, verifyFn) {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  const profile = await verifyFn(idToken); // { email, name, sub }
  const prisma = req.app.locals.prisma;

  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    // First login: role defaults to STUDENT. Lecturer/admin roles are
    // granted by an admin (see routes/admin.js), never self-assigned here.
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        role: 'STUDENT',
        authProvider: provider,
        providerId: profile.sub,
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
}

router.post('/google', (req, res, next) =>
  signIn(req, res, 'GOOGLE', verifyGoogleToken).catch(next)
);
router.post('/microsoft', (req, res, next) =>
  signIn(req, res, 'MICROSOFT', verifyMicrosoftToken).catch(next)
);

module.exports = router;
