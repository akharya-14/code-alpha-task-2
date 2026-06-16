const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "events.db");

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'attendee',   -- 'attendee' | 'organizer' | 'admin'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      location      TEXT NOT NULL,
      event_date    TEXT NOT NULL,
      capacity      INTEGER NOT NULL DEFAULT 100,
      price         REAL NOT NULL DEFAULT 0,
      category      TEXT NOT NULL DEFAULT 'General',
      organizer_id  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'published',  -- 'published' | 'cancelled' | 'draft'
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    );

    -- Registrations table
    CREATE TABLE IF NOT EXISTS registrations (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      event_id     TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'confirmed',  -- 'confirmed' | 'cancelled'
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, event_id),
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_organizer  ON events(organizer_id);
    CREATE INDEX IF NOT EXISTS idx_reg_user          ON registrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_reg_event         ON registrations(event_id);
  `);

  save();
  return db;
}

function save() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ─── Query helpers ────────────────────────────────────────────────────────────
function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(db, sql, params = []) {
  return all(db, sql, params)[0] || null;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  save();
}

module.exports = { getDb, all, one, run };
