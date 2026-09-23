// Draft only — swap the verify* stubs for real google-auth-library /
// @azure/msal-node verification before this touches production.

async function verifyGoogleToken(idToken) {
  // TODO: use google-auth-library's OAuth2Client.verifyIdToken()
  // Returns { email, name, sub } on success, throws on invalid token.
  throw new Error('verifyGoogleToken not implemented — plug in google-auth-library');
}

async function verifyMicrosoftToken(idToken) {
  // TODO: verify against Microsoft's JWKS (@azure/msal-node or jwks-rsa + jsonwebtoken)
  throw new Error('verifyMicrosoftToken not implemented — plug in MSAL');
}

// Requires a VeriRoll session JWT issued by /auth/google or /auth/microsoft
// (not the provider's raw token) on every subsequent request.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const jwt = require('jsonwebtoken');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not permitted for this role' });
    }
    next();
  };
}

module.exports = { verifyGoogleToken, verifyMicrosoftToken, requireAuth, requireRole };
