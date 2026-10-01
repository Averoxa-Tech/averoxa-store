// Wrap async route handlers so thrown errors reach errorHandler instead of crashing the process.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Route not found' });
}

// Postgres error codes that are the client's fault: FK / check violation, bad text->number, out of range.
const CLIENT_PG_CODES = new Set(['23503', '23514', '22P02', '22003']);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  let status = err.status || (CLIENT_PG_CODES.has(err.code) ? 400 : 500);
  let message = err.message || 'Internal server error';
  if (status === 400 && CLIENT_PG_CODES.has(err.code)) message = 'Invalid data: check ids and numeric values';
  if (status >= 500 && process.env.NODE_ENV === 'production') message = 'Internal server error';
  res.status(status).json({ ok: false, error: message });
}

module.exports = { asyncHandler, notFound, errorHandler };
