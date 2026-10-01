/**
 * Data layer: the whole store lives in memory for fast reads, and every
 * write is saved to PostgreSQL (table ax_state) so data survives restarts.
 * Without DATABASE_URL it simply runs in memory (local development).
 */
const { v4: uuid } = require('uuid');

const db = {
  users: [
    { id: 'u1', name: 'Demo Buyer', email: 'buyer@example.com', password: 'password123', role: 'buyer', addresses: [] },
    { id: 'u2', name: 'Demo Seller', email: 'seller@example.com', password: 'password123', role: 'seller', addresses: [] }
  ],
  sellers: [
    { id: 's1', userId: 'u2', shopName: 'Averoxa Electronics', rating: 4.6, createdAt: new Date().toISOString() }
  ],
  categories: [
    { id: 'c1', name: 'Electronics', parentId: null },
    { id: 'c2', name: 'Mobiles', parentId: 'c1' },
    { id: 'c3', name: 'Laptops', parentId: 'c1' },
    { id: 'c4', name: 'Home & Kitchen', parentId: null }
  ],
  products: [
    {
      id: 'p1', sellerId: 's1', title: 'Averoxa Buds Pro', categoryId: 'c1',
      price: 2499, mrp: 3499, stock: 120, rating: 4.3, ratingCount: 812,
      images: ['https://picsum.photos/seed/p1/400'], description: 'Wireless earbuds with active noise cancellation.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'p2', sellerId: 's1', title: 'Averoxa Phone X12', categoryId: 'c2',
      price: 18999, mrp: 21999, stock: 45, rating: 4.1, ratingCount: 233,
      images: ['https://picsum.photos/seed/p2/400'], description: '6.5" AMOLED display, 5000mAh battery.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'p3', sellerId: 's1', title: 'Averoxa Book Slim 14"', categoryId: 'c3',
      price: 54999, mrp: 59999, stock: 18, rating: 4.5, ratingCount: 97,
      images: ['https://picsum.photos/seed/p3/400'], description: 'Ultra-light laptop, 16GB RAM, 512GB SSD.',
      createdAt: new Date().toISOString()
    }
  ],
  reviews: [
    { id: 'r1', productId: 'p1', userId: 'u1', rating: 5, title: 'Great sound', body: 'Battery life is excellent.', createdAt: new Date().toISOString() }
  ],
  carts: {
    // userId -> [{ productId, qty }]
    u1: []
  },
  wishlists: {
    // userId -> [productId]
    u1: []
  },
  orders: [],
  payments: []
};

function nextId(prefix) { return prefix + '_' + uuid().slice(0, 8); }

// ---- password hashing (built-in scrypt, no extra dependency) ----
const crypto = require('crypto');
function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(p, salt, 64).toString('hex');
}
function verifyPassword(stored, p) {
  if (!String(stored).startsWith('scrypt$')) return stored === p; // legacy plain-text demo users
  const [, salt, hash] = stored.split('$');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(p, salt, 64));
}

// ---- PostgreSQL persistence ----
const pool = process.env.DATABASE_URL ? require('./db') : null;
let timer = null;

async function save() {
  if (!pool) return;
  await pool.query(
    "INSERT INTO ax_state (id, data) VALUES ('main', $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
    [JSON.stringify(db)]
  );
}

async function init() {
  if (!pool) { console.log('No DATABASE_URL: running in memory only'); return; }
  await pool.query('CREATE TABLE IF NOT EXISTS ax_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())');
  const r = await pool.query("SELECT data FROM ax_state WHERE id = 'main'");
  if (r.rows.length) { Object.assign(db, r.rows[0].data); console.log('Loaded data from PostgreSQL'); }
  else { await save(); console.log('Seeded PostgreSQL with demo data'); }
}

// Debounced save, called after every write request.
function persist() {
  if (!pool) return;
  clearTimeout(timer);
  timer = setTimeout(() => save().catch(e => console.error('Save failed:', e.message)), 300);
}

module.exports = { db, nextId, init, persist, save, hashPassword, verifyPassword };
