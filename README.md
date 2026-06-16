# ⚡ Event Registration System — Express + SQLite

Full-stack event registration system with JWT auth, role-based access control, and a frontend SPA.

---

## 🗂️ Project Structure

```
event-registration/
├── server.js                 # Entry point + seed data
├── db.js                     # SQLite setup & query helpers
├── middleware/
│   └── auth.js               # JWT middleware + role guard
├── routes/
│   ├── auth.js               # /api/auth/*
│   ├── events.js             # /api/events/*
│   ├── registrations.js      # /api/registrations/*
│   └── admin.js              # /api/admin/*
├── public/
│   └── index.html            # Frontend SPA
├── package.json
└── README.md
```

---

## 🚀 Setup on Your Laptop

### Prerequisites
- Node.js v18+ → https://nodejs.org

### Steps

```bash
# 1. Enter project folder
cd event-registration

# 2. Install dependencies
npm install

# 3. Start server
npm start

# OR with auto-restart:
npm run dev
```

Open → **http://localhost:4000**

### Demo accounts (auto-seeded)
| Email | Password | Role |
|---|---|---|
| admin@demo.com | admin123 | admin |
| organizer@demo.com | organizer123 | organizer |
| user@demo.com | user123 | attendee |

---

## 📡 Full API Reference

### Auth

| Method | Endpoint | Body | Auth | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password, role}` | — | Create account |
| POST | `/api/auth/login` | `{email, password}` | — | Login → JWT |
| GET | `/api/auth/me` | — | ✅ | Get current user |

---

### Events

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | — | List published events (filter: `?category=&search=&upcoming=true`) |
| GET | `/api/events/:id` | — | Event detail + capacity info |
| POST | `/api/events` | organizer/admin | Create event |
| PUT | `/api/events/:id` | organizer/admin | Update event |
| DELETE | `/api/events/:id` | organizer/admin | Cancel event (soft delete) |
| GET | `/api/events/:id/registrations` | organizer/admin | List attendees |

**Create event body:**
```json
{
  "title": "React Summit",
  "description": "Premier conference...",
  "location": "Pune Tech Park",
  "event_date": "2026-08-15T10:00",
  "capacity": 200,
  "price": 999,
  "category": "Technology"
}
```

---

### Registrations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/registrations` | ✅ | Register for event (`{event_id}`) |
| GET | `/api/registrations/my` | ✅ | Current user's registrations |
| GET | `/api/registrations/:id` | ✅ | Single registration detail |
| DELETE | `/api/registrations/:id` | ✅ | Cancel registration |

---

### Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard counts |
| GET | `/api/admin/users` | All users |
| POST | `/api/admin/users` | Create user with any role |
| PUT | `/api/admin/users/:id/role` | Change user role |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/events` | All events including draft/cancelled |

---

## 🗄️ Database Schema

```sql
users         (id, name, email, password, role, created_at)
events        (id, title, description, location, event_date, capacity, price, category, organizer_id, status, created_at)
registrations (id, user_id, event_id, status, registered_at)
```

**Roles:** `attendee` | `organizer` | `admin`
**Event status:** `published` | `cancelled` | `draft`
**Registration status:** `confirmed` | `cancelled`

---

## 🔒 Business Rules

- Organizers can only edit/delete their own events
- Registration blocked if event is full, past, or cancelled
- Cancellation blocked within 1 hour of event start
- Re-registering after cancellation reinstates the existing record
- Duplicate registration returns 409 with clear message
