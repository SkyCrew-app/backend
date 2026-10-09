import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MailerService {
  constructor(
    @Inject('MAIL_TRANSPORT') private readonly transporter: Transporter,
  ) {}

  async sendMail(
    to: string,
    subject: string,
    text: string,
    templateName: string,
    variables: { [key: string]: any },
  ): Promise<void> {
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
      new Logger(MailerService.name).error(
        `Erreur lors du chargement du template: ${error.message}`,
      );
      throw error;
    }
  }
}
