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
  'notification.withdrawal': '{{amount}} has been debited from your balance.',
  'notification.invoiceCreated': 'An invoice of {{amount}} has been created',
  'notification.paymentReceived':
    'A top-up of {{amount}} has been added to your account',
  'notification.paymentRefunded':
    'A refund of {{amount}} has been made to your account',
  'notification.courseCreatedForStudent':
    'Your course of {{date}} with {{instructor}} is scheduled.',
  'notification.courseCreatedForInstructor':
    'Your course of {{date}} with {{student}} is scheduled.',
  'notification.paymentFailed':
    'Your payment of {{amount}} was declined: your balance has not been credited.',
  'notification.competencyValidated':
    'A skill has been validated in your course.',
  'notification.courseComment': 'A comment has been added to your course.',
  'notification.courseCompleted': 'Your course {{courseId}} is complete.',
  'notification.courseCancelledInstructorLeft':
    'Your course of {{date}} with {{instructor}} is cancelled: they are no longer an instructor at the club.',
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
  'error.user.instructorCommitments':
    'This member still instructs {{bookings}} upcoming booking(s) and {{courses}} upcoming course(s) ({{list}}). Confirm the role change to cancel them: the students will be refunded.',
  'error.user.instructorBookingsNotCancelled':
    'The role was not changed: these bookings could not be cancelled ({{ids}}). Settle them first.',
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
  'error.flight.notFound': 'This flight does not exist or was deleted',
  'error.flight.hasIncident':
    'An incident is attached to this flight: it cannot be deleted',
  'error.aircraft.upcomingBookings':
    'This aircraft has {{count}} upcoming booking(s): cancel or move them before retiring it',
  'error.aircraft.registrationRequired':
    'Enter the registration of the aircraft',
  'error.aircraft.modelRequired': 'Enter the model of the aircraft',
  'error.aircraft.yearRequired':
    'Enter the year of manufacture of the aircraft, between {{min}} and {{max}}',
  'error.aircraft.hourlyCostRequired':
    'Enter the cost of one flight hour, in euros (0 or more)',
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
  'error.course.memberAlreadyBooked':
    'The instructor or the student already has an aircraft booked for something else in this slot',
  'error.course.ratingIsStudents':
    'The rating and feedback of a course are given by the student',
  'error.course.participantsAdminOnly':
    'Only an administrator can change the instructor or the student of a course',
  'error.course.bookedParticipants':
    'An aircraft is booked for this course: cancel that booking first to change its instructor or student.',
  'error.course.hasRecord':
    "This course is part of the student's training record: it cannot be deleted. Set it to cancelled if needed.",
  'error.course.ratingOutOfRange':
    'The rating must be a whole number between {{min}} and {{max}}',
  'error.course.cancelBookingWithoutCancelling':
    'Only cancelling a course can also cancel its aircraft booking',
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
  // Instruction flights: a booking with an instructor.
  'notification.instructionBookedForInstructor':
    'Instruction flight with {{student}} on aircraft {{registration}}, on {{date}}: you are its instructor.',
  'notification.instructionChangedForInstructor':
    'The instruction flight with {{student}} on aircraft {{registration}} has been changed. It is planned on {{date}}.',
  'notification.instructionCancelledForInstructor':
    'The instruction flight with {{student}} on aircraft {{registration}}, on {{date}}, has been cancelled.',
  'notification.instructionDeclined':
    'Your instructor {{instructor}} cancelled the instruction flight of {{date}} on aircraft {{registration}}. What you paid has been refunded.',
  'mail.instructionBooked.subject': 'New instruction flight',
  'mail.instructionChanged.subject': 'Instruction flight changed',
  'mail.instructionCancelled.subject': 'Instruction flight cancelled',
  'mail.instruction.greeting': 'Hello {{name}},',
  'mail.instruction.start': 'Start:',
  'mail.instruction.end': 'End:',
  'error.service.suspended':
    "Access to your club's space is suspended: no change can be made. Your data is kept. Contact your club's administrator or the SkyCrew provider.",
  'error.plan.featureNotIncluded':
    'This feature is part of the Club + School plan, which your club has not chosen.',
  'error.plan.aircraftLimit':
    'Your plan allows {{max}} aircraft in service and that number is reached. Take an aircraft out of service or contact your SkyCrew provider to change plan.',
  'error.plan.memberLimit':
    'Your plan allows {{max}} active member(s) and that number is reached. Deactivate the account of a member who left or contact your SkyCrew provider to change plan.',
  'error.reservation.licenceRequired':
    'Without a licence valid until the end of this flight you cannot book: add your licence in your profile or ask the club administrator to validate it.',
  'error.reservation.instructorRequired':
    'Without a valid licence you can only book with an instructor: choose the instructor of this flight',
  'error.reservation.instructorNoValidLicence':
    'This instructor has no licence valid until the end of this flight',
  'error.reservation.instructorNotFound': 'Instructor not found',
  'error.reservation.notAnInstructor':
    'The person chosen is not an active instructor of the club',
  'error.reservation.instructorIsPilot':
    'The instructor and the pilot must be two different people',
  'error.reservation.instructorAlreadyBooked':
    'This instructor is already on another flight at that time',
  'error.reservation.instructorHasCourse':
    'This instructor is teaching another student at that time',
  'error.reservation.courseNotFound': 'Course not found',
  'error.reservation.courseNotYours':
    'This course is not yours: you cannot book an aircraft for it',
  'error.reservation.courseNotScheduled':
    'An aircraft can only be booked for a scheduled course',
  'error.reservation.courseAlreadyBooked':
    'An aircraft is already booked for this course',
  'error.reservation.weeklyMaintenance':
    "This slot falls during the club's weekly maintenance ({{from}}–{{to}}): choose another slot.",
  'error.reservation.courseSlotMismatch':
    'The booking slot must overlap the course',

  // Leftovers of the business-rules audit (members, incidents, licences,
  // invoices).
  'error.incident.deleteNotAllowed':
    'Only an administrator can delete an incident. Its author can withdraw it while it is open and nobody has taken it up.',
  'error.licence.notYours': 'You can only change your own licences',
  'error.licence.unknownStatus':
    'Unknown licence status: choose active, expired or pending',
  'error.licence.numberAlreadyUsed':
    'This number already belongs to another licence of the same type',
  'notification.licenceExpiresIn':
    'Your {{licenceType}} licence expires in {{days}} day(s), on {{date}}. Remember to renew it.',
  'mail.licenceExpiring.subject':
    'Your {{licenceType}} licence is about to expire',
  'notification.licenceDigest':
    '{{count}} member licence(s) expire within the next {{days}} days ({{month}} digest).',
  'mail.licenceDigest.subject': 'Licences about to expire: {{count}}',
  'notification.aircraftGroundedByAudit':
    'Aircraft {{registration}} has been grounded after a non-conforming safety audit. Your booking No. {{reservationId}} on {{date}} is affected: please contact the club.',
  'notification.aircraftGroundedByAuditStaff':
    'Aircraft {{registration}} has been grounded after safety audit No. {{auditId}}, found non-conforming. Upcoming bookings affected: {{count}}.',
  'error.invoice.numberedCannotDelete':
    'A numbered invoice cannot be deleted: its number would be missing from the sequence of the year',
  'invoice.title': 'Invoice',
  'invoice.fileName': 'invoice',
  'invoice.number': 'Invoice No. {{number}}',
  'invoice.date': 'Date: {{date}}',
  'invoice.billedTo': 'Billed to',
  'invoice.description': 'Description',
  'invoice.amount': 'Amount',
  'invoice.total': 'Total',
  'invoice.amountPaid': 'Already paid',
  'invoice.balanceDue': 'Balance due',
  'invoice.paidBy': 'Payment method: {{method}}',
  'invoice.line.booking':
    'Booking of aircraft {{registration}}, from {{start}} to {{end}}',
  'invoice.line.instructionBooking':
    'Instruction flight on aircraft {{registration}} with instructor {{instructor}}, from {{start}} to {{end}}',
  'invoice.line.bookingNumber': 'Booking No. {{reservationId}}',
  'invoice.line.bookingPlain': 'Aircraft booking',
  'invoice.line.topUp': 'Member account top-up',
  'invoice.line.other': 'Service',
  'invoice.method.accountBalance': 'member account balance',
  'invoice.method.card': 'bank card',
  'invoice.method.paypal': 'PayPal',
  'invoice.method.cash': 'cash',
  'invoice.method.cheque': 'cheque',
  'invoice.method.transfer': 'bank transfer',
  // Flight preparation (navigation data, aircraft data, plans).
  'error.navdata.zoomIn':
    'Too many points to show (more than {{max}}): zoom in on the map',
  'error.navdata.aerodromeNotFound': 'Aerodrome {{icao}} not found',
  'error.navplan.pointNotFound':
    'A point of the route no longer exists in the data in force',
  'error.navplan.aerodromeRequired':
    'Departure, destination and alternate must be aerodromes',
  'error.navplan.legsCount':
    'There must be one leg more than waypoints ({{expected}} expected)',
  'error.navplan.notOwnPlan':
    'You can only read or change your own flight plans',
  'error.navplan.planNotFound': 'This flight plan does not exist',
  'error.navplan.aircraftNotBooked':
    'The aircraft of the plan must be the booked one',
  'error.navplan.reservationChange':
    'The booking of a saved plan cannot be changed',
  'error.navplan.reserveBelowAmc':
    'The {{label}} final reserve cannot be below {{minimum}} min (AMC1 NCO.OP.125(b))',
  'error.aircraftData.aircraftNotFound': 'This aircraft does not exist',
  'error.aircraftData.unknownTemplate': 'Unknown template: {{code}}',
  'error.aircraftData.invalidPerformance':
    'Invalid performance data: {{detail}}',
  'error.aircraftData.invalidMassBalance':
    'Invalid mass and balance data: {{detail}}',
  'error.aircraftData.incomplete':
    'Aircraft data incomplete, cannot be confirmed: {{missing}}',
  'aircraftData.missing.performance': 'cruise table',
  'aircraftData.missing.tanks': 'fuel tanks (usable capacity)',
  'aircraftData.missing.climb':
    'climb (speed, rate, fuel flow and ceiling, or table)',
  'aircraftData.missing.descent': 'descent (speed, rate and fuel flow)',
  'aircraftData.missing.reserve':
    'holding and maximum continuous power fuel flows',
  'aircraftData.missing.massBalance': 'mass and balance',
  'aircraftData.missing.weighing': 'weighing (empty mass and arm)',
  'aircraftData.missing.weighingDate': 'weighing date',
  'aircraftData.missing.mtow': 'maximum take-off mass',
  'aircraftData.missing.mlw': 'maximum landing mass',
  'aircraftData.missing.seats': 'seat stations',
  'aircraftData.missing.envelope': 'centre of gravity envelope',
  'aircraftData.missing.fuelArm': 'tank lever arms',
  'navplan.notice.disclaimer':
    'Flight preparation aid. It replaces neither the official aeronautical publications (AIP, AIP SUP, NOTAM, VAC charts), nor the aircraft flight manual, nor the judgement of the pilot in command.',
  'navplan.notice.notamCheck':
    'NOTAM and AIP SUP not included: check SOFIA Briefing (https://sofia-briefing.aviation-civile.gouv.fr) and the day’s AZBA activity before departure.',
  'navplan.notice.navdataStale':
    'Aeronautical data of cycle {{airac}} ({{date}}) OUT OF DATE — check the publications in force',
  'navplan.notice.noAirspaceData':
    'No airspace data imported: the airspaces crossed are not checked',
  'navplan.notice.unverified':
    '{{count}} area(s) near the route without a published outline, not checked: {{names}} — find them on the current chart',
  'navplan.notice.qnhDefaulted':
    'QNH unknown: computed on 1013.25 hPa, flight levels and pressure altitudes are approximate',
  'navplan.notice.perfNotValidated':
    'Performance not confirmed by an administrator: template to check against the aircraft flight manual',
  'navplan.notice.perfMissing':
    'No flight manual data for this aircraft: times and fuel estimated from the fleet sheet, not usable for a flight',
  'navplan.notice.cruiseTemperatureIgnored':
    'Leg {{leg}}: ISA deviation {{deviation}} °C not taken into account (single temperature column in the cruise table)',
  'navplan.notice.windExceedsTas':
    'Leg {{leg}}: wind stronger than the aircraft speed, leg impossible',
  'navplan.notice.performanceOutOfTable':
    'Outside the flight manual tables: {{detail}}',
  'navplan.notice.performanceIncomplete':
    'Incomplete performance data: {{detail}}',
  'navplan.notice.wmmExpired':
    'Magnetic model expired (WMM2025 valid until 31/12/2029): magnetic tracks and headings not computed',
  'navplan.notice.windUnavailable':
    'No winds aloft forecast for part of the route: calm wind assumed, enter the forecast wind (WINTEM)',
  'navplan.notice.windPilot': 'Wind entered by the pilot on at least one leg',
  'navplan.notice.nightFlight':
    'Flight partly at night from {{time}} (aviation night: from the end of evening civil twilight to the beginning of morning civil twilight, SERA): night final reserve (45 min) and a night rating required',
  'navplan.notice.nightReserveImposed':
    'Flight partly at night from {{time}} (aviation night: from the end of evening civil twilight to the beginning of morning civil twilight, SERA): the night final reserve (45 min) replaces the day reserve chosen; night rating required',
  'navplan.notice.nightApproaching':
    'Planned arrival at {{icao}} ({{role}}) at {{arrival}}, {{minutes}} min before the end of civil twilight ({{dusk}}): any delay makes it a night flight',
  'navplan.notice.qnhMetarOld':
    'QNH from a METAR of {{time}} ({{icao}}), to be updated before departure',
  'navplan.notice.qnhMetarUnknownTime':
    'QNH from a {{icao}} METAR of unknown time, to be updated before departure',
  'navplan.notice.tafNotCovering':
    'TAF {{icao}} ({{role}}) valid from {{from}} to {{to}}: it does not cover the planned time ({{time}}), check again before departure',
  'navplan.notice.tafValidityUnknown':
    'TAF {{icao}} ({{role}}): validity period not readable, check that it covers the planned time ({{time}})',
  'navplan.notice.tafMissing':
    'No TAF for {{icao}} ({{role}}): no forecast for the planned time ({{time}})',
  'navplan.notice.departureNoForecast':
    'No TAF for {{icao}} ({{role}}): the latest METAR ({{observed}}) does not describe the conditions of the departure planned at {{time}}',
  'navplan.notice.windOutOfRange':
    'Winds aloft forecast (run {{run}}) valid from {{from}} to {{to}}: the time of the flight is not covered, calm wind assumed on the legs concerned; enter the forecast wind (WINTEM)',
  'navplan.role.departure': 'departure',
  'navplan.role.destination': 'destination',
  'navplan.role.alternate': 'alternate',
  'navplan.fuel.alternateRequired':
    'The club requires an alternate in VFR: add an alternate aerodrome',
  'navplan.fuel.aboveUsable': '{{loaded}} L loaded > {{usable}} L usable',
  'navplan.fuel.insufficient':
    'Not enough fuel: {{missing}} L missing (minimum block fuel {{minimum}} L)',
  'navplan.fuel.landingBelowReserve':
    'Planned fuel at landing {{landing}} L < final reserve {{reserve}} L',
  'navplan.fuel.unknownTank': 'Unknown tank: {{tank}}',
  'navplan.fuel.tankAboveUsable':
    '{{tank}}: {{loaded}} L > {{usable}} L usable',
  'navplan.fuel.negative': '{{tank}}: negative quantity',
  'navplan.fuel.notComputed': 'Fuel not computed (see the warnings)',
  'navplan.mb.notValidated':
    'Mass and balance refused: the data of this aircraft (weighing, stations, envelope) is not confirmed by an administrator',
  'navplan.mb.noEnvelope': 'No {{category}} CG envelope for this aircraft',
  'navplan.mb.noWeighing': 'Aircraft weighing missing (empty mass and arm)',
  'navplan.mb.unknownStation': 'Unknown loading station: {{station}}',
  'navplan.mb.negativeMass': '{{station}}: negative mass',
  'navplan.mb.stationLimit': '{{station}}: {{mass}} kg > {{max}} kg',
  'navplan.mb.aboveMtow': 'Take-off mass {{mass}} kg > maximum {{max}} kg',
  'navplan.mb.aboveMlw':
    'Landing mass {{mass}} kg > maximum landing mass {{max}} kg',
  'navplan.mb.aboveMzfw': 'Zero fuel mass {{mass}} kg > maximum {{max}} kg',
  'navplan.mb.cgAft':
    'CG aft of the limits at {{moment}}: {{cg}} m > {{limit}} m ({{mass}} kg)',
  'navplan.mb.cgForward':
    'CG forward of the limits at {{moment}}: {{cg}} m < {{limit}} m ({{mass}} kg)',
  'navplan.mb.outOfEnvelope':
    'Outside the envelope at {{moment}}: {{mass}} kg, CG {{cg}} m',
  'navplan.mb.pathLeavesEnvelope':
    'The CG leaves the envelope between take-off and landing',
  'navplan.mb.moment.takeoff': 'take-off',
  'navplan.mb.moment.landing': 'landing',
  'navplan.airspace.prohibited': 'Prohibited area: entry prohibited.',
  'navplan.airspace.restricted':
    'Restricted area: entry subject to conditions. Activity: {{activity}} — check the day’s activity (NOTAM, AIP SUP, AZBA for the RTBA).',
  'navplan.airspace.danger':
    'Danger area: activity {{activity}} — check the day’s activity (NOTAM, AIP SUP).',
  'navplan.airspace.rmz': 'Radio contact mandatory {{radio}}.',
  'navplan.airspace.rmzNoRadio':
    'Radio contact mandatory (frequency: see the current chart).',
  'navplan.airspace.sivNoRadio':
    'Flight information service (frequency: see the current chart).',
  'navplan.airspace.clearanceNoRadio':
    'Clearance required — call the unit (frequency: see the current chart).',
  'navplan.airspace.tmz': 'Transponder mandatory (mode S).',
  'navplan.airspace.siv': 'Flight information service: {{radio}}.',
  'navplan.airspace.protected':
    'Overflight at the published minimum height ({{limit}}) — check.',
  'navplan.airspace.classA': 'Class A: VFR prohibited.',
  'navplan.airspace.clearance': 'Clearance required — call {{radio}}.',
  'navplan.airspace.classE':
    'No clearance in VFR; radio and transponder as RMZ/TMZ require.',
  'navplan.airspace.other': 'Airspace to check on the current chart.',
  'navplan.airspace.unverified':
    'Unverified area: {{name}}, outline not available — find it on the current chart.',
  'navplan.airspace.unverifiedUnlocated':
    'Unverified area: {{name}}, outline not available and position unknown — find it on the current chart.',
  'navplan.airspace.parachuting':
    'Parachuting up to {{limit}} (hours: {{activity}}) — keep clear or ask the unit for the activity; do not overfly without contact.',
  'navplan.airspace.aerobatics':
    'Aerobatic area up to {{limit}} (hours: {{activity}}) — avoid it when active.',
  'navplan.airspace.winch':
    'Winch launching (cable) up to {{limit}} (hours: {{activity}}) — do not overfly below that altitude.',
  'navplan.airspace.balloon':
    'Captive balloon (cable) up to {{limit}} (hours: {{activity}}) — do not overfly below that altitude.',
  'navplan.airspace.lowOverflight':
    'Low-level overflight prohibited: stay above {{limit}} (single piston engine; higher for other aircraft, see the instructions).',
  'navplan.airspace.modelAircraft':
    'Model aircraft up to {{limit}} (hours: {{activity}}) — keep a lookout.',
  'navplan.airspace.drone':
    'Drone activity up to {{limit}} (hours: {{activity}}) — keep a lookout.',
  'navplan.notice.obstacleMargin':
    '{{count}} obstacle(s) within {{corridor}} NM of the route top out less than {{margin}} ft below the planned altitude (closest to it: {{amsl}} ft before {{point}}) — see the legs and climb if needed.',
  'navplan.notice.aerodromeRestricted':
    '{{icao}} ({{role}}) is a restricted-use aerodrome: prior permission of the operator (see the aerodrome sheet and the VAC).',
  'navplan.notice.aerodromePrivate':
    "{{icao}} ({{role}}) is a private aerodrome: the owner's permission is needed.",
  'navplan.notice.aerodromeMilitary':
    '{{icao}} ({{role}}) is a military aerodrome: access by permission only (PPR).',
  'navplan.notice.aerodromeNoVfr':
    '{{icao}} ({{role}}) is not open to VFR traffic according to the SIA: check the VAC.',
  'navplan.airspace.checkHeight':
    'Limit given as a height above ground: check on the chart. Unknown activity ≠ inactive area.',
  'navplan.aerodrome.status.CAP': 'Open to public air traffic (CAP)',
  'navplan.aerodrome.status.RST':
    'Restricted use: prior permission of the operator',
  'navplan.aerodrome.status.PRV': "Private aerodrome: owner's permission",
  'navplan.aerodrome.status.MIL':
    'Military aerodrome: access by permission (PPR)',
  'navplan.aerodrome.status.OFF': 'Not an aerodrome (agency, control centre)',
  'navplan.pdf.aerodromes': 'Aerodromes',
  'navplan.pdf.rwy.qfu': 'Runway / QFU',
  'navplan.pdf.rwy.tora': 'TORA',
  'navplan.pdf.rwy.lda': 'LDA',
  'navplan.pdf.rwy.size': 'Size, surface',
  'navplan.pdf.rwy.wind': 'METAR wind (* suggested runway)',
  'navplan.pdf.rwy.components': '{{head}}, cross {{cross}}',
  'navplan.pdf.rwy.head': 'kt head',
  'navplan.pdf.rwy.tail': 'kt tail',
  'navplan.pdf.rwy.right': 'kt from the right',
  'navplan.pdf.rwy.left': 'kt from the left',
  'navplan.pdf.atsHours': 'ATS hours',
  'navplan.pdf.fuelAvailable': 'Fuel',
  'navplan.pdf.fuelNone': 'none published',
  'navplan.pdf.metarConditions':
    'METAR: wind {{wind}}, {{temperature}} °C, QNH {{qnh}} — density altitude {{da}} ft',
  'navplan.pdf.hours': 'Hours',
  'navplan.pdf.obstacles':
    'Obstacles less than 500 ft below the planned altitude, {{leg}}:',
  'navplan.pdf.freezing': '0 °C isotherm (ICON-EU forecast)',
  'navplan.pdf.freezing.route': 'halfway',
  'navplan.pdf.freezing.surface': 'at the surface',
  'navplan.pdf.relation.INSIDE': 'inside',
  'navplan.pdf.relation.NEAR_FLOOR': 'near the floor',
  'navplan.pdf.relation.NEAR_CEILING': 'near the ceiling',
  'navplan.pdf.relation.UNKNOWN_VERTICAL': 'height to check',
  'navplan.pdf.relation.BELOW': 'below',
  'navplan.pdf.relation.ABOVE': 'above',
  'navplan.pdf.title': 'Flight file',
  'navplan.pdf.navLog': 'Navigation log',
  'navplan.pdf.aircraft': 'Aircraft',
  'navplan.pdf.pilot': 'Pilot',
  'navplan.pdf.date': 'Date (UTC)',
  'navplan.pdf.route': 'Route',
  'navplan.pdf.qnh': 'QNH',
  'navplan.pdf.navdata': 'Aeronautical data',
  'navplan.pdf.winds': 'Winds',
  'navplan.pdf.status': 'Status',
  'navplan.pdf.blocking': 'OUT OF LIMITS — DO NOT DEPART',
  'navplan.pdf.warning': 'Items to check before departure',
  'navplan.pdf.ok': 'No blocking item found',
  'navplan.pdf.col.point': 'Point',
  'navplan.pdf.col.alt': 'Alt ft',
  'navplan.pdf.col.tc': 'TC',
  'navplan.pdf.col.mc': 'MC',
  'navplan.pdf.col.wind': 'Wind',
  'navplan.pdf.col.wca': 'WCA',
  'navplan.pdf.col.mh': 'MH',
  'navplan.pdf.col.tas': 'TAS',
  'navplan.pdf.col.gs': 'GS',
  'navplan.pdf.col.dist': 'Dist',
  'navplan.pdf.col.cumDist': 'Total',
  'navplan.pdf.col.time': 'Time',
  'navplan.pdf.col.cumTime': 'Total',
  'navplan.pdf.col.eta': 'ETA',
  'navplan.pdf.col.ata': 'ATA',
  'navplan.pdf.col.fuel': 'Fuel L',
  'navplan.pdf.col.fuelActual': 'Actual',
  'navplan.pdf.col.radio': 'Frequencies / airspaces',
  'navplan.pdf.fuel': 'Fuel plan',
  'navplan.pdf.fuel.taxi': 'Taxi',
  'navplan.pdf.fuel.trip': 'Trip',
  'navplan.pdf.fuel.contingency': 'Contingency',
  'navplan.pdf.fuel.alternate': 'Alternate',
  'navplan.pdf.fuel.reserve': 'Final reserve ({{minutes}} min)',
  'navplan.pdf.fuel.margin': 'Club margin',
  'navplan.pdf.fuel.minimum': 'Minimum block fuel',
  'navplan.pdf.fuel.loaded': 'Loaded',
  'navplan.pdf.fuel.extra': 'Extra',
  'navplan.pdf.fuel.landing': 'Planned at landing',
  'navplan.pdf.fuel.endurance': 'Endurance',
  'navplan.pdf.mb': 'Mass and balance',
  'navplan.pdf.mb.station': 'Station',
  'navplan.pdf.mb.mass': 'Mass kg',
  'navplan.pdf.mb.arm': 'Arm m',
  'navplan.pdf.mb.moment': 'Moment kg·m',
  'navplan.pdf.mb.takeoff': 'Take-off',
  'navplan.pdf.mb.landing': 'Landing',
  'navplan.pdf.mb.empty': 'Empty aircraft',
  'navplan.pdf.mb.notice':
    'Computed from the data entered by the club (weighing of {{date}}). The pilot in command checks it against the flight manual.',
  'navplan.pdf.airspaces': 'Airspaces crossed',
  'navplan.pdf.airspaces.none': 'No airspace crossed in the data in force',
  'navplan.pdf.airspaces.notChecked':
    'Airspaces not checked: no airspace data imported. Find the airspaces crossed on the current aeronautical chart (ICAO chart, VAC, AIP).',
  'navplan.pdf.weather': 'Weather (raw METAR / TAF, aviationweather.gov)',
  'navplan.pdf.notices': 'Warnings',
  'navplan.pdf.links':
    'NOTAM: https://sofia-briefing.aviation-civile.gouv.fr — RTBA activity: AZBA page of the SIA. NOTAM and AIP SUP checked: [ ]',
  'navplan.pdf.page': 'Page {{page}}',
  'navplan.pdf.forecastNotice':
    'Automatic forecast not checked by a forecaster.',
  'navplan.pdf.qnhSource.METAR': '{{icao}} METAR of {{time}}',
  'navplan.pdf.qnhSource.INPUT': 'entered by the pilot',
  'navplan.pdf.qnhSource.DEFAULT': 'QNH unknown, standard atmosphere',
  'navplan.pdf.navdata.airac': 'AIRAC cycle {{airac}} of {{date}}',
  'navplan.pdf.navdata.ourairports':
    'OurAirports aerodrome data of {{date}}, no AIRAC cycle',
  'navplan.pdf.navdata.none': 'no aeronautical data imported',
  'navplan.pdf.navdata.stale': 'OUT OF DATE',
  'navplan.pdf.sun': 'Sun (UTC)',
  'navplan.pdf.sun.line':
    '{{icao}} ({{role}}, {{date}}): civil twilight begins {{dawn}}, sunrise {{sunrise}}, sunset {{sunset}}, civil twilight ends {{dusk}}',
  'navplan.pdf.sun.night':
    'Flight partly at night from {{time}}: night final reserve (45 min).',
  'navplan.pdf.sun.day':
    'Flight entirely by day (aviation night: from the end of evening civil twilight to the beginning of morning civil twilight).',
  'navplan.pdf.windNone': '* no wind forecast: calm wind assumed',
  'navplan.pdf.status.OK': 'INFO',
  'navplan.pdf.status.WARNING': 'WARNING',
  'navplan.pdf.status.BLOCKING': 'BLOCKING',
};
