const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "event_app_secret_key_change_in_prod";

// Require valid JWT — attaches req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required." });

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// Optional auth — attaches req.user if token present, never blocks
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try { req.user = jwt.verify(header.slice(7), JWT_SECRET); } catch {}
  }
  next();
}

// Require specific role(s)
function requireRole(...roles) {
  return [
    requireAuth,
    (req, res, next) => {
      if (!roles.includes(req.user.role))
        return res.status(403).json({ error: "Insufficient permissions." });
      next();
    },
  ];
}

module.exports = { requireAuth, optionalAuth, requireRole, JWT_SECRET };
