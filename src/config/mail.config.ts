import { ConfigService } from '@nestjs/config';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';

export const mailConfig = (
  configService: ConfigService,
): SMTPTransport.Options => ({
  host: configService.get<string>('MAIL_HOST'),
  port: configService.get<number>('MAIL_PORT'),
  secure: configService.get<boolean>('MAIL_SECURE'),
  auth: {
    user: configService.get<string>('MAIL_USER'),
    pass: configService.get<string>('MAIL_PASSWORD'),
  },
});
