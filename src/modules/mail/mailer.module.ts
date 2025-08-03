import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { mailConfig } from '../../config/mail.config';
import { MailerService } from './mailer.service';

@Module({
  imports: [ConfigModule],
  providers: [
    MailerService,
    {
      provide: 'MAIL_TRANSPORT',
      useFactory: (configService: ConfigService) => {
        return nodemailer.createTransport(mailConfig(configService));
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailerService],
})
export class MailerModule {}
