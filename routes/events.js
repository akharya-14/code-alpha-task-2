const router = require("express").Router();
const { nanoid } = require("nanoid");
const { getDb, all, one, run } = require("../db");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");

// ─── GET /api/events — List all published events (with filters) ───────────────
router.get("/", optionalAuth, async (req, res) => {
  const { category, search, upcoming } = req.query;
  const db = await getDb();

  let sql = `
    SELECT e.*,
           u.name AS organizer_name,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registered_count
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.status = 'published'
  `;
  const params = [];

  if (category) { sql += " AND e.category = ?"; params.push(category); }
  if (search)   { sql += " AND (e.title LIKE ? OR e.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  if (upcoming === "true") { sql += " AND e.event_date >= datetime('now')"; }

  sql += " ORDER BY e.event_date ASC";

  const events = all(db, sql, params).map(e => ({
    ...e,
    spots_left: e.capacity - e.registered_count,
    is_full: e.registered_count >= e.capacity,
  }));

  res.json(events);
});

// ─── GET /api/events/:id — Event detail ──────────────────────────────────────
router.get("/:id", optionalAuth, async (req, res) => {
  const db = await getDb();

  const event = one(db, `
    SELECT e.*,
           u.name AS organizer_name, u.email AS organizer_email,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registered_count
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ?
  `, [req.params.id]);

  if (!event) return res.status(404).json({ error: "Event not found." });

  res.json({
    ...event,
    spots_left: event.capacity - event.registered_count,
    is_full: event.registered_count >= event.capacity,
  });
});

// ─── POST /api/events — Create event (organizer or admin) ────────────────────
router.post("/", ...requireRole("organizer", "admin"), async (req, res) => {
  const { title, description, location, event_date, capacity, price, category } = req.body;

  if (!title || !description || !location || !event_date)
    return res.status(400).json({ error: "title, description, location and event_date are required." });

  if (new Date(event_date) < new Date())
    return res.status(400).json({ error: "Event date must be in the future." });

  const db = await getDb();
  const id = nanoid();

  run(db, `
    INSERT INTO events (id, title, description, location, event_date, capacity, price, category, organizer_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `, [id, title.trim(), description.trim(), location.trim(), event_date,
      capacity || 100, price || 0, category || "General", req.user.id]);

  const event = one(db, "SELECT * FROM events WHERE id = ?", [id]);
  res.status(201).json(event);
});

// ─── PUT /api/events/:id — Update event (own events only, or admin) ───────────
router.put("/:id", requireAuth, async (req, res) => {
  const db = await getDb();
  const event = one(db, "SELECT * FROM events WHERE id = ?", [req.params.id]);

  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.organizer_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "You can only edit your own events." });

  const { title, description, location, event_date, capacity, price, category, status } = req.body;

  run(db, `
    UPDATE events SET
      title       = COALESCE(?, title),
      description = COALESCE(?, description),
      location    = COALESCE(?, location),
      event_date  = COALESCE(?, event_date),
      capacity    = COALESCE(?, capacity),
      price       = COALESCE(?, price),
      category    = COALESCE(?, category),
      status      = COALESCE(?, status)
    WHERE id = ?
  `, [title, description, location, event_date, capacity, price, category, status, req.params.id]);

  res.json(one(db, "SELECT * FROM events WHERE id = ?", [req.params.id]));
});

// ─── DELETE /api/events/:id — Cancel/delete event ────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const db = await getDb();
  const event = one(db, "SELECT * FROM events WHERE id = ?", [req.params.id]);

  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.organizer_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "You can only delete your own events." });

  // Soft-delete: mark as cancelled (preserves registration history)
  run(db, "UPDATE events SET status = 'cancelled' WHERE id = ?", [req.params.id]);
  res.json({ message: "Event cancelled successfully." });
});

// ─── GET /api/events/:id/registrations — Who registered (organizer/admin) ────
router.get("/:id/registrations", requireAuth, async (req, res) => {
  const db = await getDb();
  const event = one(db, "SELECT * FROM events WHERE id = ?", [req.params.id]);

  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.organizer_id !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Access denied." });

  const regs = all(db, `
    SELECT r.id, r.status, r.registered_at,
           u.id AS user_id, u.name, u.email
    FROM registrations r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ?
    ORDER BY r.registered_at ASC
  `, [req.params.id]);

  res.json(regs);
});

module.exports = router;
