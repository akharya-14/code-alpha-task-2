const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
const { getDb, one, run } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  const db = await getDb();

  if (one(db, "SELECT id FROM users WHERE email = ?", [email.toLowerCase()]))
    return res.status(409).json({ error: "Email already registered." });

  const id = nanoid();
  const hash = await bcrypt.hash(password, 10);
  // Only allow 'attendee' or 'organizer' on self-register; 'admin' via DB only
  const safeRole = role === "organizer" ? "organizer" : "attendee";

  run(db, "INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)",
    [id, name.trim(), email.toLowerCase(), hash, safeRole]);

  const token = jwt.sign({ id, name: name.trim(), email: email.toLowerCase(), role: safeRole }, JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({ token, user: { id, name: name.trim(), email: email.toLowerCase(), role: safeRole } });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const db = await getDb();
  const user = one(db, "SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid email or password." });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
const { requireAuth } = require("../middleware/auth");
router.get("/me", requireAuth, async (req, res) => {
  const db = await getDb();
  const user = one(db, "SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

module.exports = router;
