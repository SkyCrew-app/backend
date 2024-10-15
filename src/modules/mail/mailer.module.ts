import { Module } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';

@Module({
  providers: [
    MailerService,
    {
      provide: 'MAIL_TRANSPORT',
      useFactory: () => {
        return nodemailer.createTransport({
          host: 'mailhog', // Adresse du serveur MailHog
          port: 1025, // Port de MailHog
          secure: false, // Pas de TLS
        });
      },
    },
  ],
  exports: [MailerService],
})
export class MailerModule {}
