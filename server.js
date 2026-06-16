const express = require("express");
const cors    = require("cors");
const path    = require("path");
const bcrypt  = require("bcryptjs");
const { nanoid } = require("nanoid");
const { getDb, one, run } = require("./db");

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/events",        require("./routes/events"));
app.use("/api/registrations", require("./routes/registrations"));
app.use("/api/admin",         require("./routes/admin"));

// Catch-all: serve frontend for any non-API route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Seed demo data on first run ─────────────────────────────────────────────
async function seed() {
  const db = await getDb();
  if (one(db, "SELECT id FROM users LIMIT 1")) return; // already seeded

  console.log("🌱 Seeding demo data...");

  const adminId = nanoid();
  const orgId   = nanoid();
  const userId  = nanoid();

  const adminHash = await bcrypt.hash("admin123", 10);
  const orgHash   = await bcrypt.hash("organizer123", 10);
  const userHash  = await bcrypt.hash("user123", 10);

  run(db, "INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)",
    [adminId, "Admin User",       "admin@demo.com",     adminHash, "admin"]);
  run(db, "INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)",
    [orgId,   "Event Organizer",  "organizer@demo.com", orgHash,   "organizer"]);
  run(db, "INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)",
    [userId,  "Demo Attendee",    "user@demo.com",      userHash,  "attendee"]);

  const events = [
    { title: "React Summit 2026",    desc: "Premier React conference with workshops and keynotes.", loc: "Pune Tech Park", date: "2026-08-15 10:00:00", cap: 200, price: 999,  cat: "Technology" },
    { title: "DSA Bootcamp",         desc: "Intensive 2-day data structures & algorithms bootcamp.", loc: "Online (Zoom)",  date: "2026-07-20 09:00:00", cap: 50,  price: 499,  cat: "Education"  },
    { title: "Startup Networking Night", desc: "Meet founders, investors and builders.", loc: "CoWork Café, Pune", date: "2026-07-05 18:00:00", cap: 80,  price: 0,    cat: "Networking" },
    { title: "ML Workshop: GenAI",   desc: "Hands-on with LLMs, RAG and fine-tuning.", loc: "SBJITMR, Nagpur",   date: "2026-09-10 10:00:00", cap: 40,  price: 799,  cat: "Technology" },
    { title: "Campus Placement Prep", desc: "Mock interviews, resume reviews and aptitude drills.", loc: "Online",         date: "2026-07-01 11:00:00", cap: 150, price: 0,    cat: "Education"  },
  ];

  for (const e of events) {
    const eid = nanoid();
    run(db, `INSERT INTO events (id,title,description,location,event_date,capacity,price,category,organizer_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
      [eid, e.title, e.desc, e.loc, e.date, e.cap, e.price, e.cat, orgId]);
  }

  console.log("✅ Seed complete!");
  console.log("   admin@demo.com     / admin123");
  console.log("   organizer@demo.com / organizer123");
  console.log("   user@demo.com      / user123\n");
}

app.listen(PORT, async () => {
  await seed();
  console.log(`\n🚀 Event Registration System`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API Base: http://localhost:${PORT}/api`);
  console.log(`   Press Ctrl+C to stop\n`);
});
