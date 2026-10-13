import { JwtService } from '@nestjs/jwt';
import {
  protectUploads,
  setUploadHeaders,
} from '../protect-uploads.middleware';

const SECRET = 'uploads-test-secret';
const sign = (payload: object, secret = SECRET) =>
  new JwtService({ secret }).sign(payload, { expiresIn: '5m' });

const pilotToken = (extra: object = {}) =>
  sign({ sub: 3, email: 'p@example.com', role: 'Pilote', ...extra });
const adminToken = () =>
  sign({ sub: 1, email: 'a@example.com', role: 'Administrateur' });

// The members as the database knows them.
const members: Record<string, any> = {
  'p@example.com': {
    id: 3,
    email: 'p@example.com',
    sessionVersion: 0,
    role: { role_name: 'Pilote' },
  },
  'a@example.com': {
    id: 1,
    email: 'a@example.com',
    sessionVersion: 0,
    role: { role_name: 'Administrateur' },
  },
};
const findUser = jest.fn(async (email: string) => members[email] ?? null);
// The licence documents and the member each belongs to.
const licenceHolders: Record<string, number[]> = {
  '/uploads/licences/ppl.pdf': [3],
  '/uploads/licences/other.pdf': [8],
};
const holdersOf = jest.fn(async (url: string) => licenceHolders[url] ?? []);

const run = async (path: string, token?: string) => {
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

  await protectUploads(findUser, holdersOf)(request, response, next);

  return { served: next.mock.calls.length === 1, status: response.statusCode };
};

describe('protectUploads', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    members['p@example.com'].sessionVersion = 0;
    members['p@example.com'].role = { role_name: 'Pilote' };
    members['p@example.com'].is_active = true;
    findUser.mockClear();
  });

  it.each(['/users/3/photo.png', '/tmp/article.jpg'])(
    'serves %s without a session',
    async (path) => {
      expect(await run(path)).toEqual({ served: true, status: undefined });
    },
  );

  it.each([
    '/maintenance/4/rapport.pdf',
    '/12/manuel.pdf',
    '/licences/ppl.pdf',
    '/exports/financial-report.pdf',
  ])('refuses %s without a session', async (path) => {
    expect(await run(path)).toEqual({ served: false, status: 401 });
  });

  it.each([
    '/maintenance/4/rapport.pdf',
    '/12/manuel.pdf',
    '/licences/ppl.pdf',
  ])('serves %s to a signed-in member', async (path) => {
    expect(await run(path, pilotToken())).toEqual({
      served: true,
      status: undefined,
    });
  });

  // Rewritten: licence documents used to be served to any signed-in member.
  it('keeps a licence document for its holder and administrators', async () => {
    expect(await run('/licences/other.pdf', pilotToken())).toEqual({
      served: false,
      status: 403,
    });
    expect(await run('/licences/unknown.pdf', pilotToken())).toEqual({
      served: false,
      status: 403,
    });
    expect(await run('/licences/other.pdf', adminToken())).toEqual({
      served: true,
      status: undefined,
    });
    expect(holdersOf).toHaveBeenCalledWith('/uploads/licences/other.pdf');
  });

  it('keeps a directory nobody classified for administrators', async () => {
    expect(await run('/invoices/2026-001.pdf', pilotToken())).toEqual({
      served: false,
      status: 403,
    });
    expect(await run('/invoices/2026-001.pdf', adminToken())).toEqual({
      served: true,
      status: undefined,
    });
  });

  it('refuses the session of a deactivated member', async () => {
    members['p@example.com'].is_active = false;

    expect(await run('/maintenance/4/rapport.pdf', pilotToken())).toEqual({
      served: false,
      status: 401,
    });
  });

  it('keeps the financial exports for administrators', async () => {
    expect(await run('/exports/financial-report.pdf', pilotToken())).toEqual({
      served: false,
      status: 403,
    });
    expect(await run('/exports/financial-report.pdf', adminToken())).toEqual({
      served: true,
      status: undefined,
    });
  });

  it.each([
    '/users/../exports/financial-report.pdf',
    '/users/%2e%2e/exports/financial-report.pdf',
    '/tmp/../maintenance/4/rapport.pdf',
  ])('judges %s by the directory it really points to', async (path) => {
    expect(await run(path)).toEqual({ served: false, status: 401 });
  });

  it.each(['/', '/..'])('answers not found for %s', async (path) => {
    expect(await run(path)).toEqual({ served: false, status: 404 });
  });

  it('does not let a leading .. reach outside the uploads directory', async () => {
    // Normalised to /secret.env, a non-public entry of the uploads root.
    expect(await run('/../secret.env')).toEqual({ served: false, status: 401 });
  });

  it('answers bad request for a path that cannot be decoded', async () => {
    expect(await run('/users/%E0%A4%A')).toEqual({
      served: false,
      status: 400,
    });
  });

  it.each([
    ['a token signed with another secret', () => sign({ sub: 3 }, 'other')],
    ['a malformed token', () => 'not-a-jwt'],
    [
      'a two-factor challenge',
      () => sign({ sub: 3, email: 'p@example.com', purpose: '2fa' }),
    ],
    ['a session of a deleted account', () => sign({ email: 'gone@x.fr' })],
    ['a token without e-mail', () => sign({ sub: 3 })],
  ])('does not accept %s as a session', async (_label, token) => {
    expect(await run('/maintenance/4/rapport.pdf', token())).toEqual({
      served: false,
      status: 401,
    });
  });

  describe('after a password change', () => {
    it('refuses the sessions opened before it', async () => {
      const before = pilotToken({ sv: 0 });
      expect(await run('/maintenance/4/rapport.pdf', before)).toEqual({
        served: true,
        status: undefined,
      });

      members['p@example.com'].sessionVersion = 1;

      expect(await run('/maintenance/4/rapport.pdf', before)).toEqual({
        served: false,
        status: 401,
      });
      expect(
        await run('/maintenance/4/rapport.pdf', pilotToken({ sv: 1 })),
      ).toEqual({ served: true, status: undefined });
    });

    it('treats a token without version as opened before any change', async () => {
      members['p@example.com'].sessionVersion = 2;

      expect(await run('/licences/ppl.pdf', pilotToken())).toEqual({
        served: false,
        status: 401,
      });
    });
  });

  it('judges the role held today, not the one written in the token', async () => {
    const formerAdmin = sign({
      email: 'p@example.com',
      role: 'Administrateur',
    });

    expect(await run('/exports/financial-report.pdf', formerAdmin)).toEqual({
      served: false,
      status: 403,
    });
  });

  it('refuses when the user cannot be loaded', async () => {
    findUser.mockRejectedValueOnce(new Error('database down'));

    expect(await run('/licences/ppl.pdf', pilotToken())).toEqual({
      served: false,
      status: 401,
    });
  });

  it('does not query the database for the public directories', async () => {
    await run('/users/3/photo.png', pilotToken());

    expect(findUser).not.toHaveBeenCalled();
  });
});

describe('setUploadHeaders', () => {
  const headersFor = (filePath: string) => {
    const headers: Record<string, string> = {};
    setUploadHeaders(
      {
        setHeader: (name: string, value: string) => (headers[name] = value),
      } as any,
      filePath,
    );
    return headers;
  };

  it.each([
    '/uploads/users/3/photo.PNG',
    '/uploads/tmp/a.jpeg',
    '/uploads/4/manuel.pdf',
  ])('lets the browser display %s', (filePath) => {
    expect(headersFor(filePath)).toEqual({
      'X-Content-Type-Options': 'nosniff',
    });
  });

  it.each([
    '/uploads/tmp/page.html',
    '/uploads/users/3/photo.svg',
    '/uploads/tmp/script.js',
    '/uploads/tmp/photo.png.htm',
    '/uploads/tmp/sans-extension',
  ])('has %s downloaded instead of displayed', (filePath) => {
    expect(headersFor(filePath)).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'attachment',
    });
  });
});
