import { NextFunction, Request, Response } from 'express';
import { extname, posix } from 'path';
import { SessionUser } from '../auth/access';
import { userOfSessionToken } from '../auth/session';
import {
  decideUploadAccess,
  DocumentHoldersLoader,
  uploadAccessOf,
} from '../uploads/upload-access';

// Profile pictures (users/) and article images (tmp/) are shown by their
// link, sometimes outside a session. Everything else under /uploads needs a
// session, and more for licences and financial exports: see upload-access.

// Loads the user of a session; the application wires it to the database.
export type UploadsUser = SessionUser & {
  sessionVersion?: number | null;
  is_active?: boolean | null;
};
export type SessionUserLoader = (email: string) => Promise<UploadsUser | null>;

export const protectUploads =
  (
    findUserByEmail: SessionUserLoader,
    holdersOfDocument: DocumentHoldersLoader = async () => [],
  ) =>
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
    const segments = requestedPath.split('/').filter(Boolean);
    const [directory] = segments;

    if (!directory || directory === '..') {
      response.status(404).json({ message: 'File not found' });
      return;
    }

    if (uploadAccessOf(directory) === 'public') {
      next();
      return;
    }

    // Same rule as the API: a session opened before the last password change
    // is refused, and the role is the current one, not the one in the token.
    const user = await userOfSessionToken(
      request.cookies?.token,
      findUserByEmail,
    );

    const decision = await decideUploadAccess(
      segments,
      user,
      holdersOfDocument,
    );

    if (decision === 'unauthenticated') {
      response.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (decision === 'forbidden') {
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
