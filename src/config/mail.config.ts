import { ConfigService } from '@nestjs/config';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';

// Implicit TLS is the rule on this port; elsewhere the connection starts in
// clear and is upgraded with STARTTLS when the server offers it.
const IMPLICIT_TLS_PORT = 465;

export const mailConfig = (
  configService: ConfigService,
): SMTPTransport.Options => {
  const port = Number(configService.get('MAIL_PORT')) || 587;
  const user = configService.get<string>('MAIL_USER');

  return {
    host: configService.get<string>('MAIL_HOST'),
    port,
    secure: port === IMPLICIT_TLS_PORT,
    // A local mail catcher needs no account; a real provider does.
    auth: user
      ? {
          user,
          pass:
            configService.get<string>('MAIL_PASSWORD') ??
            configService.get<string>('MAIL_PASS'),
        }
      : undefined,
  };
};
