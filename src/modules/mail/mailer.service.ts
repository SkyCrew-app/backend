import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    @Inject('MAIL_TRANSPORT') private readonly transporter: Transporter,
  ) {}

  // Sends an e-mail and says whether it left. It never throws: an e-mail that
  // cannot be sent must not undo the action it only reports (a reservation,
  // a password change…). The reason is logged for the operator.
  async sendMail(
    to: string,
    subject: string,
    text: string,
    templateName: string,
    variables: { [key: string]: any },
  ): Promise<boolean> {
    if (!process.env.MAIL_HOST) {
      this.logger.warn(
        `E-mail "${templateName}" not sent: no mail server is configured (MAIL_HOST)`,
      );
      return false;
    }

    try {
      const templatePath = join(
        this.resolveTemplatesDirectory(),
        `${templateName}.hbs`,
      );
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
