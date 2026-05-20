const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

// ── GET all items ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, category, status, search, limit = 30, offset = 0 } = req.query;

    let sql = `
      SELECT items.*, users.name as reporter_name
      FROM items
      JOIN users ON items.user_id = users.id
      WHERE 1=1
    `;
    const params = [];

    if (type)     { sql += ' AND items.type = ?';     params.push(type); }
    if (category) { sql += ' AND items.category = ?'; params.push(category); }
    if (status)   { sql += ' AND items.status = ?';   params.push(status); }
    if (search) {
      const s = `%${search}%`;
      sql += ' AND (LOWER(items.title) LIKE ? OR LOWER(items.description) LIKE ? OR LOWER(items.location) LIKE ?)';
      params.push(s.toLowerCase(), s.toLowerCase(), s.toLowerCase());
    }

    sql += ' ORDER BY items.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ── GET single item ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet(
      `SELECT items.*, users.name as reporter_name, users.email as reporter_email
       FROM items JOIN users ON items.user_id = users.id
       WHERE items.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Item not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST create item ───────────────────────────────────────
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { type, title, description, category, location, date_reported, color, brand } = req.body;
    if (!type || !title || !category || !location || !date_reported)
      return res.status(400).json({ error: 'type, title, category, location, and date_reported are required' });

    const id = uuidv4();
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    await dbRun(
      `INSERT INTO items (id, user_id, type, title, description, category, location, date_reported, image_path, color, brand)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, type, title, description || null, category, location, date_reported, image_path, color || null, brand || null]
    );

    res.status(201).json({ id, message: 'Item reported successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// ── GET matches ────────────────────────────────────────────
router.get('/:id/matches', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const oppositeType = item.type === 'lost' ? 'found' : 'lost';

    // Build keyword list from title, color, brand, category
    const titleWords = (item.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywords = [item.category, item.color, item.brand, ...titleWords]
      .filter(Boolean)
      .map(k => k.toLowerCase());

    if (!keywords.length) return res.json([]);

    // Fetch opposite-type active items
    const candidates = await dbAll(
      `SELECT items.*, users.name as reporter_name
       FROM items JOIN users ON items.user_id = users.id
       WHERE items.type = ? AND items.id != ? AND items.status != 'claimed'`,
      [oppositeType, req.params.id]
    );

    // Score each candidate
    const scored = candidates.map(c => {
      const hay = [
        (c.title || '').toLowerCase(),
        (c.description || '').toLowerCase(),
        (c.category || '').toLowerCase(),
        (c.color || '').toLowerCase(),
        (c.brand || '').toLowerCase(),
      ].join(' ');

      let score = 0;
      keywords.forEach(kw => {
        if (c.category && c.category.toLowerCase() === kw) score += 3;
        else if (hay.includes(kw)) score += 1;
        if (c.color && c.color.toLowerCase() === kw) score += 2;
        if (c.brand && c.brand.toLowerCase() === kw) score += 2;
      });
      return { ...c, match_score: score };
    });

    const matches = scored
      .filter(c => c.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 10);

    res.json(matches);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Matching failed' });
  }
});

// ── PATCH status ───────────────────────────────────────────
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'matched', 'claimed'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const item = await dbGet('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await dbRun('UPDATE items SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ── DELETE item ────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await dbRun('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
