import { randomUUID } from 'crypto';

/**
 * Attaches a unique correlation ID to every incoming request.
 *
 * - If the client sent `X-Request-Id`, we reuse it (useful for tracing
 *   requests across microservices / the frontend).
 * - Otherwise, generate a fresh UUID v4.
 * - The ID is exposed as `req.id` and echoed back as `X-Request-Id`
 *   on every response, so client + server logs can be correlated.
 *
 * This MUST be mounted before the httpLogger so the logger can read req.id.
 */
const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = incoming && /^[a-zA-Z0-9-]{1,128}$/.test(incoming)
    ? incoming
    : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export default requestId;