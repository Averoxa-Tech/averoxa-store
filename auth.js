const jwt = require('jsonwebtoken');
const { query, COLS } = require('../data/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (process.env.RENDER && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required in production. Set it in Render -> Environment.');
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Missing bearer token' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }

  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.sub]);
    if (!rows[0]) return res.status(401).json({ ok: false, error: 'Invalid token' });
    const addr = await query(`SELECT ${COLS.ADDRESS} FROM addresses WHERE user_id = $1 ORDER BY created_at, id`, [payload.sub]);
    req.user = { ...rows[0], addresses: addr.rows };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ ok: false, error: `Requires ${role} role` });
    }
    next();
  };
}

// Seller role + an existing seller profile; sets req.seller.
async function requireSeller(req, res, next) {
  if (!req.user || req.user.role !== 'seller') {
    return res.status(403).json({ ok: false, error: 'Requires seller role' });
  }
  try {
    const { rows } = await query(`SELECT ${COLS.SELLER} FROM sellers WHERE user_id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(403).json({ ok: false, error: 'No seller profile for this account' });
    req.seller = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, requireRole, requireSeller, signToken, JWT_SECRET };
