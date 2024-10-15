import { Module } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { AdministrationResolver } from './administration.resolver';
import { UsersModule } from '../users/users.module';
import { MailerModule } from '../mail/mailer.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UsersModule,
    MailerModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AdministrationService, AdministrationResolver],
  exports: [AdministrationService],
})
export class AdministrationModule {}
