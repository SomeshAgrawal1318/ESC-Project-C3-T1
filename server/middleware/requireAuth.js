// middleware/requireAuth.js
// --------------------------
// The actual enforcement point: mounted in front of every route that should
// require a signed-in caller (see app.js). Everything under /api/auth stays
// unmounted from this - you need to reach login without a token first.
//
// Stateless: verifies the JWT's signature and expiry only, never touches
// Mongo. req.username is the one thing routes can trust afterwards; nothing
// else about the account is attached, so a stale token can't leak stale
// profile data.

import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to access this resource.');
  }

  try {
    const payload = verifyToken(token);
    req.username = payload.username;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired - sign in again.');
  }

  next();
});

export default requireAuth;
