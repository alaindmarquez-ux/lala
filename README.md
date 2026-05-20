# 🎒 Campus Lost & Found

A full-stack web app for reporting and recovering lost items on campus, with smart keyword-based matching between lost and found reports.

---

## Features

- **Report lost or found items** with photos, category, color, brand, and location
- **Image upload** (stored on disk, served statically)
- **Smart matching** — automatically surfaces similar items based on category, color, brand, and keywords
- **User auth** — JWT-based registration & login
- **Status tracking** — active → matched → claimed
- **Filter & search** — by type, category, or free-text search
- **Fully responsive** — works on mobile and desktop
- **Single-file frontend** — no build step needed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (via sqlite3) |
| Auth | bcryptjs + JWT |
| File Upload | Multer |
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Deployment | Render (free tier) |

---

## Local Development

### 1. Clone & install

```bash
git clone <your-repo-url>
cd campus-lost-found
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Run

```bash
npm run dev     # with nodemon (auto-reload)
# or
npm start       # plain node
```

Open http://localhost:3000

---

## Deploy to Render (Free)

### Option A — render.yaml (recommended)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo — Render reads `render.yaml` automatically.
4. Set `JWT_SECRET` to any long random string in the Environment tab.
5. Click **Deploy**. Done.

### Option B — Manual Web Service

1. Push to GitHub.
2. Render → **New Web Service** → connect repo.
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. Add env vars:
   - `JWT_SECRET` = (any secure random string)
   - `NODE_ENV` = `production`
5. Add a **Disk** (free tier: 1 GB) mounted at `/opt/render/project/src/uploads`.
6. Deploy.

> **Note:** The free Render plan spins down after inactivity. Uploads persist on the attached disk.

---

## Project Structure

```
campus-lost-found/
├── server.js              # Express app entry point
├── render.yaml            # Render deployment config
├── package.json
├── .env.example
├── src/
│   ├── database.js        # SQLite init & connection
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   └── routes/
│       ├── auth.js        # POST /api/auth/register|login
│       └── items.js       # CRUD + matching for items
├── public/
│   └── index.html         # Full SPA frontend (no build needed)
└── uploads/               # User-uploaded images (gitignored)
```

---

## API Reference

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` | Create account |
| POST | `/api/auth/login` | `{email, password}` | Login → JWT |

### Items

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/items` | No | List items (supports `?type=lost|found&category=X&search=X&status=X`) |
| GET | `/api/items/:id` | No | Get single item |
| GET | `/api/items/:id/matches` | No | Get keyword matches |
| POST | `/api/items` | ✅ | Create item (multipart/form-data with optional `image`) |
| PATCH | `/api/items/:id/status` | ✅ Owner | Update status (`active|matched|claimed`) |
| DELETE | `/api/items/:id` | ✅ Owner | Delete item |

---

## Customization

### Enforce school email
In `src/routes/auth.js`, uncomment:
```js
if (!email.endsWith('.edu')) return res.status(400).json({ error: 'Please use your school email address' });
```
Replace `.edu` with your school's domain (e.g. `.university.edu.ph`).

### Switch to PostgreSQL (for production scale)
Replace `sqlite3` with `pg`, update `src/database.js` connection string, and adjust SQL syntax as needed.

### Add TensorFlow.js image matching
Install `@tensorflow/tfjs-node` and `@tensorflow-models/mobilenet`, extract feature vectors on upload, and compare cosine similarity in the `/matches` route.

---

## Screenshots

> Register → Log in → Report an item (with photo) → Browse & filter → View matches → Mark claimed.

---

## License

MIT — built as a capstone project.
