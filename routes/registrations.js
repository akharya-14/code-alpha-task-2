const router = require("express").Router();
const { nanoid } = require("nanoid");
const { getDb, all, one, run } = require("../db");
const { requireAuth } = require("../middleware/auth");

// ─── POST /api/registrations — Register for an event ─────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: "event_id is required." });

  const db = await getDb();

  const event = one(db, "SELECT * FROM events WHERE id = ?", [event_id]);
  if (!event)                          return res.status(404).json({ error: "Event not found." });
  if (event.status !== "published")    return res.status(400).json({ error: "Event is not open for registration." });
  if (new Date(event.event_date) < new Date())
    return res.status(400).json({ error: "Cannot register for a past event." });

  // Check capacity
  const confirmed = one(db,
    "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'confirmed'",
    [event_id]).c;
  if (confirmed >= event.capacity)
    return res.status(409).json({ error: "Event is fully booked." });

  // Prevent duplicate active registration
  const existing = one(db,
    "SELECT * FROM registrations WHERE user_id = ? AND event_id = ?",
    [req.user.id, event_id]);

  if (existing) {
    if (existing.status === "confirmed")
      return res.status(409).json({ error: "You are already registered for this event." });

    // Re-activate a previously cancelled registration
    run(db, "UPDATE registrations SET status = 'confirmed', registered_at = datetime('now') WHERE id = ?", [existing.id]);
    return res.json({ message: "Registration reinstated.", registration_id: existing.id });
  }

  const id = nanoid();
  run(db, "INSERT INTO registrations (id, user_id, event_id) VALUES (?,?,?)",
    [id, req.user.id, event_id]);

  res.status(201).json({
    message: "Successfully registered!",
    registration: { id, user_id: req.user.id, event_id, status: "confirmed" },
    event: { title: event.title, event_date: event.event_date, location: event.location },
  });
});

// ─── GET /api/registrations/my — Get current user's registrations ─────────────
router.get("/my", requireAuth, async (req, res) => {
  const db = await getDb();

  const regs = all(db, `
    SELECT r.id AS registration_id, r.status, r.registered_at,
           e.id AS event_id, e.title, e.description, e.location,
           e.event_date, e.price, e.category, e.status AS event_status,
           u.name AS organizer_name
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    JOIN users  u ON u.id = e.organizer_id
    WHERE r.user_id = ?
    ORDER BY e.event_date ASC
  `, [req.user.id]);

  res.json(regs);
});

// ─── GET /api/registrations/:id — Registration detail ────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const db = await getDb();

  const reg = one(db, `
    SELECT r.*, e.title, e.event_date, e.location, e.price
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.id = ?
  `, [req.params.id]);

  if (!reg) return res.status(404).json({ error: "Registration not found." });
  if (reg.user_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Access denied." });

  res.json(reg);
});

// ─── DELETE /api/registrations/:id — Cancel registration ─────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const db = await getDb();

  const reg = one(db, `
    SELECT r.*, e.event_date FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.id = ?
  `, [req.params.id]);

  if (!reg) return res.status(404).json({ error: "Registration not found." });
  if (reg.user_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Access denied." });
  if (reg.status === "cancelled")
    return res.status(400).json({ error: "Registration already cancelled." });

  // Block cancellation within 1 hour of event
  const eventTime = new Date(reg.event_date).getTime();
  if (Date.now() > eventTime - 60 * 60 * 1000)
    return res.status(400).json({ error: "Cannot cancel within 1 hour of the event." });

  run(db, "UPDATE registrations SET status = 'cancelled' WHERE id = ?", [reg.id]);
  res.json({ message: "Registration cancelled successfully." });
});

module.exports = router;
