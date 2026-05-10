/**
 * database.js — Appointment storage via PostgreSQL
 *
 * Requires DATABASE_URL in environment, e.g.:
 *   postgres://voicebot:voicebot123@db:5432/voicebot
 *
 * Falls back to in-memory Map if DATABASE_URL is not set (local dev without Docker).
 */

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// ── In-memory fallback ───────────────────────────────────────────────────────
const store = new Map();

// ── Init: create table if not exists ────────────────────────────────────────
async function init() {
  if (!pool) {
    console.log('[DB] No DATABASE_URL set — using in-memory store');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id          TEXT PRIMARY KEY,
      nome        TEXT NOT NULL,
      cognome     TEXT NOT NULL,
      servizio    TEXT NOT NULL,
      data        TEXT NOT NULL,
      ora         TEXT NOT NULL,
      motivo      TEXT,
      stato       TEXT DEFAULT 'confermato',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[DB] PostgreSQL connected, table ready');
}

// ── Public API ───────────────────────────────────────────────────────────────

async function save(appointment) {
  if (!pool) { store.set(appointment.id, appointment); return appointment; }
  await pool.query(
    `INSERT INTO appointments (id, nome, cognome, servizio, data, ora, motivo, stato)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET stato = EXCLUDED.stato`,
    [appointment.id, appointment.nome, appointment.cognome,
     appointment.servizio, appointment.data, appointment.ora,
     appointment.motivo, appointment.stato]
  );
  return appointment;
}

async function findById(id) {
  if (!pool) return store.get(id) || null;
  const r = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function findByDateTime(data, ora, servizio) {
  if (!pool) {
    for (const a of store.values())
      if (a.data === data && a.ora === ora && a.servizio === servizio) return a;
    return null;
  }
  const r = await pool.query(
    'SELECT * FROM appointments WHERE data=$1 AND ora=$2 AND servizio=$3',
    [data, ora, servizio]
  );
  return r.rows[0] || null;
}

async function getAll() {
  if (!pool) return Array.from(store.values()).sort((a,b) => new Date(a.data+'T'+a.ora) - new Date(b.data+'T'+b.ora));
  const r = await pool.query('SELECT * FROM appointments ORDER BY data, ora');
  return r.rows;
}

async function remove(id) {
  if (!pool) {
    const a = store.get(id); if (!a) return null;
    store.delete(id); return a;
  }
  const r = await pool.query('DELETE FROM appointments WHERE id=$1 RETURNING *', [id]);
  return r.rows[0] || null;
}

module.exports = { init, save, findById, findByDateTime, getAll, remove };