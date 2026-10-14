// The e-mails a member always receives, whatever their "e-mail
// notifications" setting: they open, protect or report a change to the
// account. Every other e-mail (booking and course notices, reminders,
// digests) follows the setting. Templates are named as in
// src/modules/templates.
export const ESSENTIAL_EMAIL_TEMPLATES: readonly string[] = [
  // Invitation: the account cannot be opened without it.
  'confirmation-email',
  'reset-password',
  // Security notices: password changed, two-factor enabled, profile or
  // role changed by an administrator.
  'change-password',
  '2fa-enabled',
  'update-user',
];

export const isEssentialEmail = (templateName: string): boolean =>
  ESSENTIAL_EMAIL_TEMPLATES.includes(templateName);
