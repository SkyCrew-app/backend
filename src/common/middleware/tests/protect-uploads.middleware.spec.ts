import { JwtService } from '@nestjs/jwt';
import { protectUploads } from '../protect-uploads.middleware';

const SECRET = 'uploads-test-secret';
const sign = (payload: object, secret = SECRET) =>
  new JwtService({ secret }).sign(payload, { expiresIn: '5m' });

const pilotToken = () =>
  sign({ sub: 3, email: 'p@example.com', role: 'Pilote' });
const adminToken = () =>
  sign({ sub: 1, email: 'a@example.com', role: 'Administrateur' });

const run = (path: string, token?: string) => {
  const request: any = { path, cookies: token ? { token } : {} };
  const response: any = {
    statusCode: undefined,
    status: jest.fn(function (code: number) {
      response.statusCode = code;
      return response;
    }),
    json: jest.fn(),
  };
  const next = jest.fn();

  protectUploads(request, response, next);

  return { served: next.mock.calls.length === 1, status: response.statusCode };
};

describe('protectUploads', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it.each(['/users/3/photo.png', '/tmp/article.jpg'])(
    'serves %s without a session',
    (path) => {
      expect(run(path)).toEqual({ served: true, status: undefined });
    },
  );

  it.each([
    '/maintenance/4/rapport.pdf',
    '/12/manuel.pdf',
    '/licences/ppl.pdf',
    '/exports/financial-report.pdf',
  ])('refuses %s without a session', (path) => {
    expect(run(path)).toEqual({ served: false, status: 401 });
  });

  it.each([
    '/maintenance/4/rapport.pdf',
    '/12/manuel.pdf',
    '/licences/ppl.pdf',
  ])('serves %s to a signed-in member', (path) => {
    expect(run(path, pilotToken())).toEqual({
      served: true,
      status: undefined,
    });
  });

  it('keeps the financial exports for administrators', () => {
    expect(run('/exports/financial-report.pdf', pilotToken())).toEqual({
      served: false,
      status: 403,
    });
    expect(run('/exports/financial-report.pdf', adminToken())).toEqual({
      served: true,
      status: undefined,
    });
  });

  it.each([
    '/users/../exports/financial-report.pdf',
    '/users/%2e%2e/exports/financial-report.pdf',
    '/tmp/../maintenance/4/rapport.pdf',
  ])('judges %s by the directory it really points to', (path) => {
    expect(run(path).served).toBe(false);
    expect(run(path).status).toBe(401);
  });

  it.each(['/', '/..'])('answers not found for %s', (path) => {
    expect(run(path)).toEqual({ served: false, status: 404 });
  });

  it('does not let a leading .. reach outside the uploads directory', () => {
    // Normalised to /secret.env, a non-public entry of the uploads root.
    expect(run('/../secret.env')).toEqual({ served: false, status: 401 });
  });

  it('answers bad request for a path that cannot be decoded', () => {
    expect(run('/users/%E0%A4%A')).toEqual({ served: false, status: 400 });
  });

  it.each([
    ['a token signed with another secret', () => sign({ sub: 3 }, 'other')],
    ['a malformed token', () => 'not-a-jwt'],
    ['a two-factor challenge', () => sign({ sub: 3, purpose: '2fa' })],
  ])('does not accept %s as a session', (_label, token) => {
    expect(run('/maintenance/4/rapport.pdf', token())).toEqual({
      served: false,
      status: 401,
    });
  });
});
