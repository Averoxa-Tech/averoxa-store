const router = require('express').Router();
const { db, nextId, hashPassword, verifyPassword } = require('../data/store');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ ok: false, error: 'name, email, password are required' });
  if (db.users.find(u => u.email === email)) return res.status(409).json({ ok: false, error: 'Email already registered' });

  const user = { id: nextId('u'), name, email, password: hashPassword(password), role: role === 'seller' ? 'seller' : 'buyer', addresses: [] };
  db.users.push(user);
  db.carts[user.id] = [];
  db.wishlists[user.id] = [];

  const token = signToken(user);
  res.status(201).json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user || !verifyPassword(user.password, password)) return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  if (!user.password.startsWith('scrypt$')) user.password = hashPassword(password);

  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// POST /api/auth/refresh — re-issue a token for an already-authenticated user
router.post('/refresh', requireAuth, asyncHandler(async (req, res) => {
  const token = signToken(req.user);
  res.json({ ok: true, token });
}));

// POST /api/auth/logout — stateless JWT: client just discards the token
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  res.json({ ok: true, message: 'Logged out. Discard the token on the client.' });
}));

// GET /api/auth/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { id, name, email, role, addresses } = req.user;
  res.json({ ok: true, user: { id, name, email, role, addresses } });
}));

module.exports = router;
