import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';
import { mailConfig } from '../../config/mail.config';

@Module({
  imports: [ConfigModule],
  providers: [
    MailerService,
    {
      provide: 'MAIL_TRANSPORT',
      useFactory: (configService: ConfigService) => {
        const transportOptions = mailConfig(configService);
        return nodemailer.createTransport(transportOptions);
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailerService],
})
export class MailModule {}
