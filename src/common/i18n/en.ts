import type { TranslationKey } from './fr';

export const en: Record<TranslationKey, string> = {
  'notification.twoFactorEnabled': 'Two-factor authentication enabled',
  'notification.userUpdated': 'Your details have been updated',
  'notification.reservationConfirmed':
    'Your booking for aircraft {{registration}} has been confirmed.',
  'notification.reservationModified':
    'Your booking for aircraft {{registration}} has been changed.',
  'notification.reservationCancelled':
    'Your booking for aircraft {{registration}} has been cancelled.',
  'notification.withdrawal':
    'A payment of {{amount}} has been taken from your account',
  'notification.invoiceCreated': 'An invoice of {{amount}} has been created',
  'notification.paymentReceived':
    'A top-up of {{amount}} has been added to your account',
  'notification.paymentRefunded':
    'A refund of {{amount}} has been made to your account',
  'notification.courseCreatedForStudent':
    'Your course with instructor {{instructorId}} has been created.',
  'notification.courseCreatedForInstructor':
    'Your course with student {{studentId}} has been created.',
  'notification.competencyValidated':
    'A skill has been validated in your course.',
  'notification.courseComment': 'A comment has been added to your course.',
  'notification.courseCompleted': 'Your course {{courseId}} is complete.',
  'notification.flightPlanCreated':
    'Your flight plan from {{origin}} to {{destination}} has been created',
  'notification.flightPlanGenerated':
    'Your flight plan from {{origin}} to {{destination}} has been generated automatically',
  'notification.licenceExpired': 'Your {{licenceType}} licence has expired.',
  'notification.licenceExpiringSoon':
    'Your {{licenceType}} licence expires soon, on {{date}}. Please take the necessary steps.',
  'notification.reservationPending':
    'Your booking no. {{reservationId}} is not confirmed. Please confirm it.',
  'notification.missingFlightPlan':
    'Your flight tomorrow for booking no. {{reservationId}} has no flight plan. Please submit one.',
  'notification.incompleteFlightPlan':
    'Your flight tomorrow for booking no. {{reservationId}} has an incomplete flight plan. Please complete it.',
  'notification.missingPassengerCount':
    'The number of passengers for your flight tomorrow (booking no. {{reservationId}}) is missing. Please fill it in.',
  'notification.reservationFinished':
    'Your booking no. {{reservationId}} has ended. Please close the flight.',

  'mail.welcome.subject': 'Welcome to our platform',
  'mail.welcome.text':
    'Welcome to our platform. Please follow the link below to confirm your e-mail address',
  'mail.twoFactorEnabled.subject': 'Two-factor authentication enabled',
  'mail.twoFactorEnabled.text':
    'Two-factor authentication has been enabled successfully',
  'mail.userUpdated.subject': 'Your details have been updated',
  'mail.userUpdated.text': 'Your details have been updated successfully.',
  'mail.passwordChanged.subject': 'Your password has been changed',
  'mail.passwordChanged.text': 'Your password has been changed successfully',
  'mail.passwordReset.subject': 'Resetting your password',
  'mail.passwordReset.text': 'A reset of your password has been requested.',
  'mail.reservationConfirmed.subject': 'Your booking is confirmed',
  'mail.reservationConfirmed.text':
    'Your booking for aircraft {{registration}} has been confirmed.',
  'mail.reservationModified.subject': 'Your booking has been changed',
  'mail.reservationModified.text':
    'Your booking for aircraft {{registration}} has been changed.',
  'mail.reservationCancelled.subject': 'Your booking has been cancelled',
  'mail.reservationCancelled.text':
    'Your booking for aircraft {{registration}} has been cancelled.',

  'error.reservation.aircraftNotFound':
    'The aircraft with ID {{aircraftId}} does not exist.',
  'error.reservation.aircraftAlreadyBooked':
    'This aircraft is already booked for the selected dates.',
  'error.reservation.userNotFound':
    'The user with ID {{userId}} does not exist.',
  'error.reservation.noClubSettings': 'No club settings found',
  'error.reservation.noValidLicence':
    'You do not hold a valid licence to book this aircraft',
  'error.reservation.insufficientBalance':
    'Insufficient balance to book this aircraft',
  'error.flight.notOwnFlightUpdate': 'You can only edit your own flights',
  'error.flight.notOwnFlightExport': 'You can only export your own flights',
  'error.flight.alreadyClosed': 'This flight is already closed',
  'error.payment.amountOutOfRange':
    'The amount must be between {{min}} and {{max}} euros',
  'error.payment.notOwnPayment': 'You can only confirm your own payments',
  'error.payment.notConfirmable': 'This payment can no longer be confirmed',
  'error.payment.notConfirmedByProvider':
    'The payment has not been confirmed by the payment provider',

  'checklist.templateDeleted': 'The template "{{name}}" has been deleted.',
  'checklist.templateDeactivated':
    'The template "{{name}}" is used by {{count}} completed checklist(s): it has been deactivated instead of deleted, to keep the history.',
};
