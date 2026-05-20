const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDB() {
  const database = await getDB();

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      date_reported TEXT NOT NULL,
      image_path TEXT,
      status TEXT DEFAULT 'active',
      color TEXT,
      brand TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  saveDB();
}

// Helper: run a write query and persist
function dbRun(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await getDB();
      database.run(sql, params);
      saveDB();
      resolve();
    } catch (e) { reject(e); }
  });
}

// Helper: get one row
function dbGet(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await getDB();
      const stmt = database.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        resolve(stmt.getAsObject());
      } else {
        resolve(null);
      }
      stmt.free();
    } catch (e) { reject(e); }
  });
}

// Helper: get all rows
function dbAll(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await getDB();
      const results = [];
      const stmt = database.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      resolve(results);
    } catch (e) { reject(e); }
  });
}

module.exports = { getDB, initDB, dbRun, dbGet, dbAll };
