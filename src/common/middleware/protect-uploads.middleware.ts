import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { posix } from 'path';
import { ROLE_ADMIN } from '../auth/access';

// Profile pictures (users/) and article images (tmp/) are shown by their
// link, sometimes outside a session. Everything else under /uploads —
// aircraft and maintenance documents, licences — needs a session, and the
// financial exports an administrator.
const PUBLIC_DIRECTORIES = ['users', 'tmp'];
const ADMIN_DIRECTORIES = ['exports'];

const sessionOf = (request: Request): { role?: string } | null => {
  const token = request.cookies?.token;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return null;
  }

  try {
    const payload = new JwtService({ secret }).verify(token);
    // Single-purpose tokens (two-factor challenge…) are not sessions.
    return payload.purpose ? null : payload;
  } catch {
    return null;
  }
};

export const protectUploads = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  let requestedPath: string;
  try {
    requestedPath = posix.normalize(decodeURIComponent(request.path));
  } catch {
    response.status(400).json({ message: 'Bad request' });
    return;
  }

  // The directory is read after normalisation, so `users/../exports/x`
  // is judged as `exports`.
  const [directory] = requestedPath.split('/').filter(Boolean);

  if (!directory || directory === '..') {
    response.status(404).json({ message: 'File not found' });
    return;
  }

  if (PUBLIC_DIRECTORIES.includes(directory)) {
    next();
    return;
  }

  const session = sessionOf(request);

  if (!session) {
    response.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (ADMIN_DIRECTORIES.includes(directory) && session.role !== ROLE_ADMIN) {
    response.status(403).json({ message: 'Forbidden' });
    return;
  }

  next();
};
