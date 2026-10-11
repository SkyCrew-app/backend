import { ConfigService } from '@nestjs/config';
import { mailConfig } from './mail.config';

const configWith = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('mailConfig', () => {
  it('signs in to a real provider and lets the connection be encrypted', () => {
    const options = mailConfig(
      configWith({
        MAIL_HOST: 'smtp.example.com',
        // Environment values are text.
        MAIL_PORT: '587',
        MAIL_USER: 'user@example.com',
        MAIL_PASSWORD: 'secret',
      }),
    );

    expect(options).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'secret' },
    });
    // Nothing turns STARTTLS or the certificate check off.
    expect(options).not.toHaveProperty('ignoreTLS');
    expect(options).not.toHaveProperty('tls');
  });

  it('uses implicit TLS on port 465', () => {
    const options = mailConfig(
      configWith({ MAIL_HOST: 'smtp.example.com', MAIL_PORT: '465' }),
    );

    expect(options.secure).toBe(true);
  });

  it('accepts the password under its shorter name', () => {
    const options = mailConfig(
      configWith({ MAIL_USER: 'user@example.com', MAIL_PASS: 'secret' }),
    );

    expect(options.auth).toEqual({ user: 'user@example.com', pass: 'secret' });
  });

  it('sends without an account to a local mail catcher', () => {
    const options = mailConfig(
      configWith({ MAIL_HOST: 'localhost', MAIL_PORT: 1025, MAIL_USER: '' }),
    );

    expect(options).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: undefined,
    });
  });

  it('defaults to the submission port', () => {
    expect(mailConfig(configWith({})).port).toBe(587);
  });
});
