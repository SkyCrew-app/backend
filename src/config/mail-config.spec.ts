import { ConfigService } from '@nestjs/config';
import { mailConfig } from './mail.config';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

describe('mailConfig', () => {
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = { get: jest.fn() };
  });

  it('devrait configurer auth quand MAIL_AUTH est true', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'MAIL_HOST':
          return 'smtp.example.com';
        case 'MAIL_PORT':
          return 587;
        case 'MAIL_AUTH':
          return true;
        case 'MAIL_USER':
          return 'user@example.com';
        case 'MAIL_PASSWORD':
          return 'password123';
        default:
          return undefined;
      }
    });

    const options = mailConfig(
      configService as ConfigService,
    ) as SMTPTransport.Options;

    expect(configService.get).toHaveBeenCalledWith('MAIL_HOST');
    expect(configService.get).toHaveBeenCalledWith('MAIL_PORT');
    expect(configService.get).toHaveBeenCalledWith('MAIL_AUTH');
    expect(configService.get).toHaveBeenCalledWith('MAIL_USER');
    expect(configService.get).toHaveBeenCalledWith('MAIL_PASSWORD');

    expect(options.host).toBe('smtp.example.com');
    expect(options.port).toBe(587);
    expect(options.secure).toBe(false);
    expect(options.ignoreTLS).toBe(true);
    expect(options.requireTLS).toBe(false);
    expect(options.auth).toEqual({
      user: 'user@example.com',
      pass: 'password123',
    });
    expect(options.tls).toEqual({ rejectUnauthorized: false });
  });

  it('devrait définir auth à null quand MAIL_AUTH est false', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'MAIL_HOST':
          return 'smtp.example.org';
        case 'MAIL_PORT':
          return 2500;
        case 'MAIL_AUTH':
          return false;
        default:
          return undefined;
      }
    });

    const options = mailConfig(
      configService as ConfigService,
    ) as SMTPTransport.Options;

    expect(configService.get).toHaveBeenCalledWith('MAIL_HOST');
    expect(configService.get).toHaveBeenCalledWith('MAIL_PORT');
    expect(configService.get).toHaveBeenCalledWith('MAIL_AUTH');

    expect(options.host).toBe('smtp.example.org');
    expect(options.port).toBe(2500);
    expect(options.secure).toBe(false);
    expect(options.ignoreTLS).toBe(true);
    expect(options.requireTLS).toBe(false);
    expect(options.auth).toBeNull();
    expect(options.tls).toEqual({ rejectUnauthorized: false });
  });
});
