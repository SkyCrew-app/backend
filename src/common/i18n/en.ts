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
  'error.reservation.memberInactive':
    'This member is deactivated: no booking can be made in their name',
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

  // Members, accounts, roles and club settings.
  'error.auth.passwordTooShort':
    'The password must be at least {{min}} characters long',
  'error.auth.invitationInvalid':
    'This activation link is invalid or has expired. Ask a club administrator for a new invitation.',
  'error.auth.accountDeactivated':
    'This account is deactivated. Contact a club administrator.',
  'error.auth.twoFactorProofRequired':
    'To replace two-factor authentication, confirm your password or a code from your current app.',
  'error.user.emailInvalid': 'This e-mail address is not valid',
  'error.user.emailAlreadyUsed':
    'An account already exists with this e-mail address',
  'error.user.notFound': 'Member not found',
  'error.user.roleNotFound': 'Role not found',
  'error.user.lastAdministrator':
    'The club must keep at least one active administrator: this account is the last one.',
  'error.user.hasHistory':
    'This member has a history in the club (bookings, flights, invoices…) and cannot be deleted. Deactivate the account instead.',
  'error.user.alreadyActivated':
    'This member has already activated their account',
  'error.role.builtIn':
    'The role "{{name}}" is required by the application: it can be neither renamed nor deleted.',
  'error.role.nameRequired': 'The role name is required',
  'error.role.nameAlreadyUsed': 'A role already has this name',
  'error.role.inUse':
    'This role is held by {{count}} member(s) and cannot be deleted.',
  'error.settings.cannotDelete': 'The club settings cannot be deleted',
  'error.settings.alreadyExist':
    'The club settings already exist: edit them instead of creating them again',
  // Bookings and money (business-rules audit).
  'error.reservation.notFound': 'Booking not found',
  'error.reservation.endBeforeStart':
    'The end time must be after the start time',
  'error.reservation.tooShort': 'A booking lasts at least {{minutes}} minutes',
  'error.reservation.tooLong': 'A booking cannot exceed {{hours}} hours',
  'error.reservation.inThePast': 'A booking cannot start in the past',
  'error.reservation.clubClosedDay': 'The club is closed on that day',
  'error.reservation.outsideOpeningHours':
    "The booking must fit within the club's opening hours, from {{opening}} to {{closing}}",
  'error.reservation.aircraftUnavailable':
    'This aircraft is not available for booking',
  'error.reservation.aircraftInMaintenance':
    'This aircraft is in maintenance during this slot',
  'error.reservation.pilotAlreadyBooked':
    'This pilot already has a booking on another aircraft at that time',
  'error.reservation.noLessonThatDay':
    'Without a valid licence, only an instruction flight can be booked, on a day an instructor has scheduled a lesson with you',
  'error.reservation.invalidPrice':
    'The hourly rate of this aircraft is not valid',
  'error.reservation.alreadyStarted':
    'A booking that has started can no longer be changed',
  'error.reservation.holderCannotChange':
    'A booking cannot be handed over to another member: cancel it and book in their name',
  'error.reservation.priceUnknown':
    'The amount paid for this booking is not known: its slot cannot be changed. Cancel it and book again, or contact an administrator',
  'error.reservation.flightClosed':
    'The flight of this booking is closed: it can no longer be cancelled.',
  'error.reservation.flightFlown':
    'A flight was made on this booking: only an administrator can cancel it',
  'error.reservation.cancelAfterStart':
    'This booking has started: only an administrator can cancel it',
  'error.payment.invalidAmount':
    'The amount must be positive, with at most two decimals',
  'error.payment.adjustmentTooLarge': 'The amount cannot exceed {{max}} euros',
  'error.payment.reasonRequired': 'The reason is mandatory',
  'error.payment.unknownManualMethod': 'This payment method is not recognised',
  'error.payment.debitExceedsBalance':
    "The member's balance is too low for this debit",
  'error.payment.statusLocked':
    'The status of this payment cannot be changed this way',
  'error.payment.notRefundable': 'This payment cannot be refunded',
  'error.payment.refundExceedsPayment':
    'The refund exceeds the amount of the payment',
  // Flights, fleet and training rules (audit fixes).
  'notification.aircraftGrounded':
    'Aircraft {{registration}} has been grounded after an incident. Your booking No. {{reservationId}} on {{date}} is affected: please contact the club.',
  'notification.aircraftGroundedStaff':
    'Aircraft {{registration}} has been grounded after incident No. {{incidentId}}. Upcoming bookings affected: {{count}}.',
  'error.flight.bookingRequired':
    'A flight must be attached to one of your bookings',
  'error.flight.notOwnBooking':
    'This booking is not yours: you cannot attach or close a flight on it',
  'error.flight.bookingCancelled': 'This booking is cancelled',
  'error.flight.arrivalBeforeDeparture':
    'The arrival time must be after the departure time',
  'error.flight.notOwnFlightRead': 'You can only view your own flights',
  'error.flight.notOwnFlightDelete': 'You can only delete your own flights',
  'error.flight.noBookingToClose':
    'This flight is not attached to any booking: only an administrator can close it',
  'error.flight.bookingNotStarted':
    'This flight cannot be closed before its booking has started',
  'error.flight.hoursOutOfRange':
    'The flight time must be more than 0 and no more than {{max}} hours',
  'error.flight.closedNotDeletable':
    'A closed flight can only be deleted by an administrator',
  'error.flight.hasIncident':
    'An incident is attached to this flight: it cannot be deleted',
  'error.aircraft.upcomingBookings':
    'This aircraft has {{count}} upcoming booking(s): cancel or move them before retiring it',
  'error.aircraft.heldByMaintenance':
    'This aircraft is in maintenance: its availability cannot be changed until the maintenance is over',
  'error.maintenance.endBeforeStart':
    'The end of the maintenance cannot be before its start',
  'error.maintenance.overBookings':
    'This maintenance overlaps {{count}} booking(s): {{bookings}}. Cancel or move these bookings, or choose another period.',
  'error.maintenance.technicianNotFound': 'Technician not found',
  'error.incident.unknownSeverity':
    'Unknown severity: choose low, medium or high',
  'error.incident.flightNotFound': 'Flight not found',
  'error.incident.aircraftNotFound': 'Aircraft not found',
  'error.incident.notOwnFlight':
    'You can only report an incident on your own flights',
  'error.incident.notAllowed': 'You can only edit incidents you reported',
  'error.incident.staffOnlyFields':
    'The status, author, flight and aircraft of an incident can only be changed by a technician or an administrator',
  'error.course.sameInstructorAndStudent':
    'The instructor and the student must be two different people',
  'error.course.endBeforeStart':
    'The end of the course must be after its start',
  'error.course.notAnInstructor':
    'The person chosen to give the course is not an instructor',
  'error.course.memberInactive':
    'This course cannot be planned with a deactivated account',
  'error.course.scheduleConflict':
    'The instructor or the student already has a course in this slot',
  'error.course.ratingIsStudents':
    'The rating and feedback of a course are given by the student',
  'error.course.participantsAdminOnly':
    'Only an administrator can change the instructor or the student of a course',
  'error.course.hasRecord':
    "This course is part of the student's training record: it cannot be deleted. Set it to cancelled if needed.",
  'error.course.ratingOutOfRange':
    'The rating must be a whole number between {{min}} and {{max}}',
  'error.course.notStarted': 'This course is cancelled or has not started yet',
  'error.checklist.templateInactive':
    'This checklist template is no longer in use',
  'error.checklist.notOwnBooking':
    'A checklist can only be attached to one of your bookings',
  'error.checklist.bookingCancelled': 'This booking is cancelled',
  'error.checklist.alreadyCompleted':
    'This checklist is completed: it can no longer be changed',
  'error.checklist.requiredItemsMissing':
    '{{count}} required item(s) still to be checked',
};
