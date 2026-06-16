const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { getDb, all, one, run } = require("../db");
const { requireRole } = require("../middleware/auth");

const adminOnly = requireRole("admin");

// ─── GET /api/admin/stats — Dashboard numbers ─────────────────────────────────
router.get("/stats", ...adminOnly, async (req, res) => {
  const db = await getDb();
  res.json({
    total_users:         one(db, "SELECT COUNT(*) AS c FROM users").c,
    total_events:        one(db, "SELECT COUNT(*) AS c FROM events WHERE status != 'cancelled'").c,
    total_registrations: one(db, "SELECT COUNT(*) AS c FROM registrations WHERE status = 'confirmed'").c,
    upcoming_events:     one(db, "SELECT COUNT(*) AS c FROM events WHERE event_date >= datetime('now') AND status = 'published'").c,
  });
});

// ─── GET /api/admin/users — List all users ────────────────────────────────────
router.get("/users", ...adminOnly, async (req, res) => {
  const db = await getDb();
  const users = all(db, "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC");
  res.json(users);
});

// ─── POST /api/admin/users — Create user with any role ───────────────────────
router.post("/users", ...adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required." });

  const db = await getDb();
  if (one(db, "SELECT id FROM users WHERE email = ?", [email.toLowerCase()]))
    return res.status(409).json({ error: "Email already exists." });

  const id = nanoid();
  const hash = await bcrypt.hash(password, 10);
  const safeRole = ["attendee", "organizer", "admin"].includes(role) ? role : "attendee";
  run(db, "INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)",
    [id, name, email.toLowerCase(), hash, safeRole]);

  res.status(201).json({ id, name, email: email.toLowerCase(), role: safeRole });
});

// ─── PUT /api/admin/users/:id/role — Change user role ────────────────────────
router.put("/users/:id/role", ...adminOnly, async (req, res) => {
  const { role } = req.body;
  if (!["attendee", "organizer", "admin"].includes(role))
    return res.status(400).json({ error: "Invalid role." });

  const db = await getDb();
  if (!one(db, "SELECT id FROM users WHERE id = ?", [req.params.id]))
    return res.status(404).json({ error: "User not found." });

  run(db, "UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  res.json({ message: `Role updated to ${role}.` });
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete("/users/:id", ...adminOnly, async (req, res) => {
  const db = await getDb();
  if (!one(db, "SELECT id FROM users WHERE id = ?", [req.params.id]))
    return res.status(404).json({ error: "User not found." });

  run(db, "DELETE FROM registrations WHERE user_id = ?", [req.params.id]);
  run(db, "DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ message: "User deleted." });
});

// ─── GET /api/admin/events — All events including drafts/cancelled ─────────────
router.get("/events", ...adminOnly, async (req, res) => {
  const db = await getDb();
  const events = all(db, `
    SELECT e.*, u.name AS organizer_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registered_count
    FROM events e JOIN users u ON u.id = e.organizer_id
    ORDER BY e.created_at DESC
  `);
  res.json(events);
});

module.exports = router;
