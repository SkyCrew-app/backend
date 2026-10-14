import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { isEssentialEmail } from './email-preferences';
import { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LANGUAGE, Language } from '../../common/i18n/languages';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    @Inject('MAIL_TRANSPORT') private readonly transporter: Transporter,
    // Looked up when an e-mail leaves, as AdminActionsService does: the
    // mailer keeps no dependency on the users module.
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  // Whether the member at this address turned e-mail notifications off.
  // An address that is no member's, or a lookup that fails, does not stop
  // the e-mail.
  private async declinesEmails(to: string): Promise<boolean> {
    try {
      const dataSource = this.moduleRef?.get(DataSource, { strict: false });
      if (!dataSource) {
        return false;
      }
      const rows: { email_notifications_enabled: boolean }[] =
        await dataSource.query(
          `SELECT "email_notifications_enabled" FROM "users" WHERE LOWER("email") = LOWER($1) ORDER BY "id" LIMIT 1`,
          [to],
        );
      return rows?.[0]?.email_notifications_enabled === false;
    } catch (error) {
      this.logger.warn(
        `E-mail preference of a recipient could not be read: ${(error as Error)?.message}`,
      );
      return false;
    }
  }

  // Sends an e-mail and says whether it left. It never throws: an e-mail that
  // cannot be sent must not undo the action it only reports (a reservation,
  // a password change…). The reason is logged for the operator.
  async sendMail(
    to: string,
    subject: string,
    text: string,
    templateName: string,
    variables: { [key: string]: any },
    language: Language = DEFAULT_LANGUAGE,
  ): Promise<boolean> {
    if (!process.env.MAIL_HOST) {
      this.logger.warn(
        `E-mail "${templateName}" not sent: no mail server is configured (MAIL_HOST)`,
      );
      return false;
    }

    if (!isEssentialEmail(templateName) && (await this.declinesEmails(to))) {
      this.logger.log(
        `E-mail "${templateName}" not sent: the member turned e-mail notifications off`,
      );
      return false;
    }

    try {
      const templatePath = this.resolveTemplatePath(templateName, language);
      const html = this.loadTemplate(templatePath, variables);

      await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `E-mail "${templateName}" could not be sent: ${error.message}`,
      );
      return false;
    }
  }

  // Templates sit next to the compiled modules once built
  // (dist/src/modules/templates). When running from sources without a
  // build, they are only present in the source tree.
  private resolveTemplatesDirectory(): string {
    const besideCompiledModules = join(__dirname, '..', 'templates');

    return existsSync(besideCompiledModules)
      ? besideCompiledModules
      : join(process.cwd(), 'src', 'modules', 'templates');
  }

  // French templates sit at the root of the directory, the other languages
  // in a directory of their own. A template not written in a language yet is
  // sent in French rather than not at all.
  private resolveTemplatePath(templateName: string, language: Language) {
    const directory = this.resolveTemplatesDirectory();
    const french = join(directory, `${templateName}.hbs`);
    if (language === DEFAULT_LANGUAGE) {
      return french;
    }

    const translated = join(directory, language, `${templateName}.hbs`);
    return existsSync(translated) ? translated : french;
  }

  private loadTemplate(
    templatePath: string,
    variables: { [key: string]: any },
  ): string {
    try {
      const templateFile = readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateFile);
      return template(variables);
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement du template: ${error.message}`,
      );
      throw error;
    }
  }
}
