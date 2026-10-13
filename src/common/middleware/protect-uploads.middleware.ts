import { NextFunction, Request, Response } from 'express';
import { extname, posix } from 'path';
import { isAdmin, SessionUser } from '../auth/access';
import { userOfSessionToken } from '../auth/session';

// Profile pictures (users/) and article images (tmp/) are shown by their
// link, sometimes outside a session. Everything else under /uploads —
// aircraft and maintenance documents, licences — needs a session, and the
// financial exports an administrator.
const PUBLIC_DIRECTORIES = ['users', 'tmp'];
const ADMIN_DIRECTORIES = ['exports'];

// Loads the user of a session; the application wires it to the database.
export type UploadsUser = SessionUser & { sessionVersion?: number | null };
export type SessionUserLoader = (email: string) => Promise<UploadsUser | null>;

export const protectUploads =
  (findUserByEmail: SessionUserLoader) =>
  async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
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

    // Same rule as the API: a session opened before the last password change
    // is refused, and the role is the current one, not the one in the token.
    const user = await userOfSessionToken(
      request.cookies?.token,
      findUserByEmail,
    );

    if (!user) {
      response.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (ADMIN_DIRECTORIES.includes(directory) && !isAdmin(user)) {
      response.status(403).json({ message: 'Forbidden' });
      return;
    }

    next();
  };

// Uploaded files are served from the address of the application. Only
// pictures and PDF documents are displayed by the browser; anything else —
// in particular HTML or SVG, which can carry scripts — is downloaded.
const DISPLAYED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.pdf',
];

export const setUploadHeaders = (
  response: Response,
  filePath: string,
): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!DISPLAYED_EXTENSIONS.includes(extname(filePath).toLowerCase())) {
    response.setHeader('Content-Disposition', 'attachment');
  }
};
