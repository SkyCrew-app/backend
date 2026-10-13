import { allowedOrigins, corsOrigin } from './cors.config';

describe('allowedOrigins', () => {
  it('allows only the configured origins in production', () => {
    expect(
      allowedOrigins({
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://club.example.com, https://www.example.com/',
        FRONTEND_URL: 'https://club.example.com',
      }),
    ).toEqual(['https://club.example.com', 'https://www.example.com']);
  });

  it('allows the public address of the site when it is the only one set', () => {
    expect(
      allowedOrigins({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://club.example.com/app',
      }),
    ).toEqual(['https://club.example.com']);
  });

  it('allows nothing in production when nothing is configured', () => {
    expect(allowedOrigins({ NODE_ENV: 'production' })).toEqual([]);
  });

  it('never allows the development origins in production', () => {
    const origins = allowedOrigins({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://club.example.com',
    });

    expect(origins).not.toContain('http://localhost:3000');
    expect(origins).not.toContain('http://localhost:5173');
    expect(origins).not.toContain('https://anthonydenin.dev');
  });

  it('keeps the localhost origins outside production', () => {
    expect(
      allowedOrigins({ ALLOWED_ORIGINS: 'http://localhost:3001' }),
    ).toEqual([
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  it('ignores values that are not web addresses', () => {
    expect(
      allowedOrigins({
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: '*, javascript:alert(1), ,club.example.com',
      }),
    ).toEqual([]);
  });

  it('answers the cors package with the current list', () => {
    const previous = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://club.example.com';
    delete process.env.FRONTEND_URL;
    const callback = jest.fn();

    corsOrigin('https://elsewhere.example', callback);

    expect(callback).toHaveBeenCalledWith(null, ['https://club.example.com']);
    process.env = previous;
  });
});
