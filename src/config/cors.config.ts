// Origins of the development tools, never allowed in production.
const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

type Environment = Record<string, string | undefined>;

// "https://club.example.com/" -> "https://club.example.com"; null when the
// value is not an http(s) address.
const originOf = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
};

// The origins allowed to call the API with the session cookie, for HTTP and
// for the websocket alike. In production: only ALLOWED_ORIGINS (comma
// separated) and the public address of the site (FRONTEND_URL).
export function allowedOrigins(env: Environment = process.env): string[] {
  const configured = [
    ...(env.ALLOWED_ORIGINS ?? '').split(','),
    env.FRONTEND_URL ?? '',
  ]
    .filter((value) => value.trim())
    .map(originOf)
    .filter((origin): origin is string => origin !== null);

  const origins =
    env.NODE_ENV === 'production'
      ? configured
      : [...DEVELOPMENT_ORIGINS, ...configured];

  return Array.from(new Set(origins));
}

// For the `origin` option of the cors package: read at each request, so the
// list follows the environment loaded at start-up.
export const corsOrigin = (
  _origin: string | undefined,
  callback: (error: Error | null, origins?: string[]) => void,
): void => callback(null, allowedOrigins());
