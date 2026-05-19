import { Inject, Injectable } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
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
    // Utiliser un chemin qui fonctionnera en développement et en production
    const templatePath = join(
      process.cwd(),
      process.env.NODE_ENV === 'production' ? 'dist' : 'src',
      'modules',
      'template',
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

  private loadTemplate(
    templatePath: string,
    variables: { [key: string]: any },
  ): string {
    try {
      const templateFile = readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateFile);
      return template(variables);
    } catch (error) {
      console.error(`Erreur lors du chargement du template: ${error.message}`);
      throw error;
    }
  }
}
