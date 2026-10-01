const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { init, persist, save } = require('./data/store');

const app = express();
app.use(cors());
app.use(express.json());

// Save data to PostgreSQL after every write request.
app.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', persist);
  next();
});

// Simple request log — replace with morgan/winston in production.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/', (req, res) => res.json({ ok: true, service: 'Averoxa E-commerce API', docs: '/api-docs.html' }));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/sellers', require('./routes/sellers.routes'));
app.use('/api/recommendations', require('./routes/recommendations.routes'));
app.use('/api', require('./routes/reviews.routes')); // exposes /api/products/:id/reviews and /api/reviews/:id

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET is not set. Set it in your environment before going live.');

init()
  .catch(e => console.error('Database init failed, running in memory:', e.message))
  .finally(() => app.listen(PORT, () => console.log(`Averoxa E-commerce API running on port ${PORT}`)));

process.on('SIGTERM', async () => { try { await save(); } catch (e) {} process.exit(0); });

module.exports = app;
