// French texts are the reference: the keys and the {{parameters}} of every
// other language are checked against this file.
export const fr = {
  'notification.twoFactorEnabled': 'Authentification à deux facteurs activée',
  'notification.userUpdated': 'Vos informations ont été mises à jour',
  'notification.reservationConfirmed':
    "Votre réservation pour l'avion {{registration}} a été confirmée.",
  'notification.reservationModified':
    "Votre réservation pour l'avion immatriculé {{registration}} a été modifiée.",
  'notification.reservationCancelled':
    "Votre réservation pour l'avion immatriculé {{registration}} a été annulée.",
  'notification.withdrawal': '{{amount}} ont été débités de votre solde.',
  'notification.invoiceCreated': 'Une facture de {{amount}} a été créée',
  'notification.paymentReceived':
    'Un ajout de {{amount}} a été effectué sur votre compte',
  'notification.paymentRefunded':
    'Un remboursement de {{amount}} a été effectué sur votre compte',
  'notification.courseCreatedForStudent':
    'Votre cours du {{date}} avec {{instructor}} est planifié.',
  'notification.courseCreatedForInstructor':
    'Votre cours du {{date}} avec {{student}} est planifié.',
  'notification.paymentFailed':
    "Votre paiement de {{amount}} a été refusé : votre solde n'a pas été crédité.",
  'notification.competencyValidated':
    'Une compétence a été validée dans votre cours.',
  'notification.courseComment': 'Un commentaire a été ajouté à votre cours.',
  'notification.courseCompleted': 'Votre cours {{courseId}} est terminé.',
  'notification.courseCancelledInstructorLeft':
    "Votre cours du {{date}} avec {{instructor}} est annulé : cette personne n'est plus instructeur au club.",
  'notification.flightPlanCreated':
    'Votre plan de vol de {{origin}} à {{destination}} a été créé.',
  'notification.flightPlanGenerated':
    'Votre plan de vol de {{origin}} à {{destination}} a été généré automatiquement.',
  'notification.licenceExpired': 'Votre licence {{licenceType}} est expirée.',
  'notification.licenceExpiringSoon':
    'Votre licence {{licenceType}} expirera bientôt, le {{date}}. Veuillez prendre les mesures nécessaires.',
  'notification.reservationPending':
    "Votre réservation N°{{reservationId}} n'est pas confirmée. Veuillez la confirmer.",
  'notification.missingFlightPlan':
    "Votre vol prévu demain pour la réservation N°{{reservationId}} n'a pas de plan de vol. Veuillez le soumettre.",
  'notification.incompleteFlightPlan':
    'Votre vol prévu demain pour la réservation N°{{reservationId}} a un plan de vol incomplet. Veuillez le compléter.',
  'notification.missingPassengerCount':
    "Le nombre de passagers pour votre vol prévu demain (Réservation N°{{reservationId}}) n'est pas renseigné. Veuillez le compléter.",
  'notification.reservationFinished':
    'Votre réservation N°{{reservationId}} est terminée. Veuillez clôturer votre vol.',

  'mail.welcome.subject': 'Bienvenue sur notre plateforme',
  'mail.welcome.text':
    'Bienvenue sur notre plateforme, veuillez cliquer sur le lien suivant pour confirmer votre adresse email',
  'mail.twoFactorEnabled.subject': 'Authentification à deux facteurs activée',
  'mail.twoFactorEnabled.text':
    "L'authentification à deux facteurs a été activée avec succès",
  'mail.userUpdated.subject': 'Vos informations ont été mises à jour',
  'mail.userUpdated.text': 'Vos informations ont été mises à jour avec succès.',
  'mail.passwordChanged.subject': 'Votre mot de passe a été modifié',
  'mail.passwordChanged.text': 'Votre mot de passe a été modifié avec succès',
  'mail.passwordReset.subject': 'Réinitialisation de votre mot de passe',
  'mail.passwordReset.text':
    'Une réinitialisation de votre mot de passe a été demandée.',
  'mail.reservationConfirmed.subject': 'Confirmation de votre réservation',
  'mail.reservationConfirmed.text':
    "Votre réservation pour l'avion {{registration}} a été confirmée.",
  'mail.reservationModified.subject': 'Modification de votre réservation',
  'mail.reservationModified.text':
    "Votre réservation pour l'avion immatriculé {{registration}} a été modifiée.",
  'mail.reservationCancelled.subject': 'Annulation de votre réservation',
  'mail.reservationCancelled.text':
    "Votre réservation pour l'avion immatriculé {{registration}} a été annulée.",

  'error.reservation.aircraftNotFound':
    "L'avion avec l'ID {{aircraftId}} n'existe pas.",
  'error.reservation.aircraftAlreadyBooked':
    'Cet avion est déjà réservé pour les dates spécifiées.',
  'error.reservation.userNotFound':
    "L'utilisateur avec l'ID {{userId}} n'existe pas.",
  'error.reservation.memberInactive':
    'Ce membre est désactivé : aucune réservation ne peut être faite à son nom',
  'error.reservation.noClubSettings':
    "Aucune configuration d'administration trouvée",
  'error.reservation.insufficientBalance':
    'Solde insuffisant pour réserver cet avion',
  'error.flight.notOwnFlightUpdate':
    'Vous ne pouvez modifier que vos propres vols',
  'error.flight.notOwnFlightExport':
    'Vous ne pouvez exporter que vos propres vols',
  'error.flight.alreadyClosed': 'Ce vol est déjà clôturé',
  'error.payment.amountOutOfRange':
    'Le montant doit être compris entre {{min}} et {{max}} euros',
  'error.payment.notOwnPayment':
    'Vous ne pouvez confirmer que vos propres paiements',
  'error.payment.notConfirmable': 'Ce paiement ne peut plus être confirmé',
  'error.payment.notConfirmedByProvider':
    "Le paiement n'a pas été confirmé par le prestataire",

  'checklist.templateDeleted': 'Le modèle « {{name}} » a été supprimé.',
  'checklist.templateDeactivated':
    "Le modèle « {{name}} » est utilisé par {{count}} checklist(s) déjà remplie(s) : il a été désactivé au lieu d'être supprimé, afin de conserver l'historique.",

  // Members, accounts, roles and club settings.
  'error.auth.passwordTooShort':
    'Le mot de passe doit contenir au moins {{min}} caractères',
  'error.auth.invitationInvalid':
    "Ce lien d'activation est invalide ou a expiré. Demandez une nouvelle invitation à un administrateur du club.",
  'error.auth.accountDeactivated':
    'Ce compte est désactivé. Contactez un administrateur du club.',
  'error.auth.twoFactorProofRequired':
    'Pour remplacer la double authentification, confirmez votre mot de passe ou un code de votre application actuelle.',
  'error.user.emailInvalid': "Cette adresse e-mail n'est pas valide",
  'error.user.emailAlreadyUsed':
    'Un compte existe déjà avec cette adresse e-mail',
  'error.user.notFound': 'Membre introuvable',
  'error.user.roleNotFound': 'Rôle introuvable',
  'error.user.lastAdministrator':
    'Le club doit garder au moins un administrateur actif : ce compte est le dernier.',
  'error.user.hasHistory':
    'Ce membre a un historique dans le club (réservations, vols, factures…) : il ne peut pas être supprimé. Désactivez son compte à la place.',
  'error.user.instructorCommitments':
    'Ce membre instruit encore {{bookings}} réservation(s) et {{courses}} cours à venir ({{list}}). Confirmez le changement de rôle pour les annuler : les élèves seront remboursés.',
  'error.user.instructorBookingsNotCancelled':
    "Le rôle n'a pas été changé : ces réservations n'ont pas pu être annulées ({{ids}}). Réglez-les d'abord.",
  'error.user.alreadyActivated': 'Ce membre a déjà activé son compte',
  'error.role.builtIn':
    "Le rôle « {{name}} » est nécessaire au fonctionnement de l'application : il ne peut être ni renommé ni supprimé.",
  'error.role.nameRequired': 'Le nom du rôle est requis',
  'error.role.nameAlreadyUsed': 'Un rôle porte déjà ce nom',
  'error.role.inUse':
    'Ce rôle est attribué à {{count}} membre(s) : il ne peut pas être supprimé.',
  'error.settings.cannotDelete':
    'Les réglages du club ne peuvent pas être supprimés',
  'error.settings.alreadyExist':
    'Les réglages du club existent déjà : modifiez-les au lieu de les recréer',
  // Bookings and money (business-rules audit).
  'error.reservation.notFound': 'Réservation introuvable',
  'error.reservation.endBeforeStart':
    "L'heure de fin doit être après l'heure de début",
  'error.reservation.tooShort':
    'Une réservation dure au moins {{minutes}} minutes',
  'error.reservation.tooLong':
    'Une réservation ne peut pas dépasser {{hours}} heures',
  'error.reservation.inThePast':
    'Une réservation ne peut pas commencer dans le passé',
  'error.reservation.clubClosedDay': 'Le club est fermé ce jour-là',
  'error.reservation.outsideOpeningHours':
    "La réservation doit tenir dans les horaires d'ouverture du club, de {{opening}} à {{closing}}",
  'error.reservation.aircraftUnavailable':
    "Cet avion n'est pas disponible à la réservation",
  'error.reservation.aircraftInMaintenance':
    'Cet avion est en maintenance sur ce créneau',
  'error.reservation.pilotAlreadyBooked':
    'Ce pilote a déjà une réservation sur un autre avion à ce moment-là',
  'error.reservation.invalidPrice':
    "Le tarif horaire de cet avion n'est pas valide",
  'error.reservation.alreadyStarted':
    'Une réservation commencée ne peut plus être modifiée',
  'error.reservation.holderCannotChange':
    'Une réservation ne peut pas être transférée à un autre membre : annulez-la et réservez à son nom',
  'error.reservation.priceUnknown':
    "Le montant payé pour cette réservation n'est pas connu : son créneau ne peut pas être modifié. Annulez-la et réservez à nouveau, ou contactez un administrateur",
  'error.reservation.flightClosed':
    'Le vol de cette réservation est clôturé : elle ne peut plus être annulée.',
  'error.reservation.flightFlown':
    'Un vol a été effectué sur cette réservation : seul un administrateur peut l’annuler',
  'error.reservation.cancelAfterStart':
    'Cette réservation a commencé : seul un administrateur peut l’annuler',
  'error.payment.invalidAmount':
    'Le montant doit être positif, avec deux décimales au plus',
  'error.payment.adjustmentTooLarge':
    'Le montant ne peut pas dépasser {{max}} euros',
  'error.payment.reasonRequired': 'Le motif est obligatoire',
  'error.payment.unknownManualMethod': "Ce mode de règlement n'est pas reconnu",
  'error.payment.debitExceedsBalance':
    'Le solde du membre est insuffisant pour ce débit',
  'error.payment.statusLocked':
    'Le statut de ce paiement ne peut pas être modifié ainsi',
  'error.payment.notRefundable': 'Ce paiement ne peut pas être remboursé',
  'error.payment.refundExceedsPayment':
    'Le remboursement dépasse le montant du paiement',
  // Flights, fleet and training rules (audit fixes).
  'notification.aircraftGrounded':
    "L'avion {{registration}} est immobilisé à la suite d'un incident. Votre réservation N°{{reservationId}} du {{date}} est concernée : contactez le club.",
  'notification.aircraftGroundedStaff':
    "L'avion {{registration}} a été immobilisé à la suite de l'incident N°{{incidentId}}. Réservations à venir concernées : {{count}}.",
  'error.flight.bookingRequired':
    'Un vol doit être rattaché à une de vos réservations',
  'error.flight.notOwnBooking':
    "Cette réservation n'est pas la vôtre : vous ne pouvez pas y rattacher ni y clôturer un vol",
  'error.flight.bookingCancelled': 'Cette réservation est annulée',
  'error.flight.arrivalBeforeDeparture':
    "L'heure d'arrivée doit être postérieure à l'heure de départ",
  'error.flight.notOwnFlightRead':
    'Vous ne pouvez consulter que vos propres vols',
  'error.flight.notOwnFlightDelete':
    'Vous ne pouvez supprimer que vos propres vols',
  'error.flight.noBookingToClose':
    "Ce vol n'est rattaché à aucune réservation : seul un administrateur peut le clôturer",
  'error.flight.bookingNotStarted':
    'Ce vol ne peut pas être clôturé avant le début de sa réservation',
  'error.flight.hoursOutOfRange':
    'La durée du vol doit être supérieure à 0 et ne pas dépasser {{max}} heures',
  'error.flight.closedNotDeletable':
    'Un vol clôturé ne peut être supprimé que par un administrateur',
  'error.flight.notFound': "Ce vol n'existe pas ou a été supprimé",
  'error.flight.hasIncident':
    'Un incident est rattaché à ce vol : il ne peut pas être supprimé',
  'error.aircraft.upcomingBookings':
    'Cet avion a {{count}} réservation(s) à venir : annulez-les ou déplacez-les avant de le retirer',
  'error.aircraft.registrationRequired':
    "Indiquez l'immatriculation de l'avion",
  'error.aircraft.modelRequired': "Indiquez le modèle de l'avion",
  'error.aircraft.yearRequired':
    "Indiquez l'année de fabrication de l'avion, entre {{min}} et {{max}}",
  'error.aircraft.hourlyCostRequired':
    "Indiquez le coût d'une heure de vol, en euros (0 ou plus)",
  'error.aircraft.heldByMaintenance':
    "Cet avion est en maintenance : sa disponibilité ne peut pas être modifiée tant que la maintenance n'est pas terminée",
  'error.maintenance.endBeforeStart':
    'La fin de la maintenance ne peut pas précéder son début',
  'error.maintenance.overBookings':
    'Cette maintenance chevauche {{count}} réservation(s) : {{bookings}}. Annulez ou déplacez ces réservations, ou choisissez une autre période.',
  'error.maintenance.technicianNotFound': 'Technicien introuvable',
  'error.incident.unknownSeverity':
    'Gravité inconnue : choisissez faible, moyenne ou élevée',
  'error.incident.flightNotFound': 'Vol introuvable',
  'error.incident.aircraftNotFound': 'Avion introuvable',
  'error.incident.notOwnFlight':
    'Vous ne pouvez déclarer un incident que sur vos propres vols',
  'error.incident.notAllowed':
    'Vous ne pouvez modifier que les incidents que vous avez déclarés',
  'error.incident.staffOnlyFields':
    "Le statut, l'auteur, le vol et l'avion d'un incident ne peuvent être modifiés que par un technicien ou un administrateur",
  'error.course.sameInstructorAndStudent':
    "L'instructeur et l'élève doivent être deux personnes différentes",
  'error.course.endBeforeStart':
    'La fin du cours doit être postérieure à son début',
  'error.course.notAnInstructor':
    "La personne choisie pour donner le cours n'est pas instructeur",
  'error.course.memberInactive':
    'Ce cours ne peut pas être planifié avec un compte désactivé',
  'error.course.scheduleConflict':
    "L'instructeur ou l'élève a déjà un cours sur ce créneau",
  'error.course.memberAlreadyBooked':
    "L'instructeur ou l'élève a déjà un avion réservé pour autre chose sur ce créneau",
  'error.course.ratingIsStudents':
    "La note et l'avis d'un cours sont donnés par l'élève",
  'error.course.participantsAdminOnly':
    "Seul un administrateur peut changer l'instructeur ou l'élève d'un cours",
  'error.course.bookedParticipants':
    "Un avion est réservé pour ce cours : annulez d'abord cette réservation pour changer d'instructeur ou d'élève.",
  'error.course.hasRecord':
    "Ce cours fait partie du dossier de formation de l'élève : il ne peut pas être supprimé. Passez-le au statut annulé si nécessaire.",
  'error.course.ratingOutOfRange':
    'La note doit être un nombre entier entre {{min}} et {{max}}',
  'error.course.cancelBookingWithoutCancelling':
    "Seule l'annulation d'un cours peut annuler aussi sa réservation d'avion",
  'error.course.notStarted': "Ce cours est annulé ou n'a pas encore commencé",
  'error.checklist.templateInactive':
    "Ce modèle de checklist n'est plus utilisé",
  'error.checklist.notOwnBooking':
    'Une checklist ne peut être rattachée qu’à une de vos réservations',
  'error.checklist.bookingCancelled': 'Cette réservation est annulée',
  'error.checklist.alreadyCompleted':
    'Cette checklist est terminée : elle ne peut plus être modifiée',
  'error.checklist.requiredItemsMissing':
    'Il reste {{count}} point(s) obligatoire(s) à vérifier',
  // Instruction flights: a booking with an instructor.
  'notification.instructionBookedForInstructor':
    "Vol d'instruction avec {{student}} sur l'avion {{registration}}, le {{date}} : vous en êtes l'instructeur.",
  'notification.instructionChangedForInstructor':
    "Le vol d'instruction avec {{student}} sur l'avion {{registration}} a été modifié. Il est prévu le {{date}}.",
  'notification.instructionCancelledForInstructor':
    "Le vol d'instruction avec {{student}} sur l'avion {{registration}}, le {{date}}, a été annulé.",
  'notification.instructionDeclined':
    "Votre instructeur {{instructor}} a annulé le vol d'instruction du {{date}} sur l'avion {{registration}}. Ce que vous aviez payé vous est remboursé.",
  'mail.instructionBooked.subject': "Nouveau vol d'instruction",
  'mail.instructionChanged.subject': "Vol d'instruction modifié",
  'mail.instructionCancelled.subject': "Vol d'instruction annulé",
  'mail.instruction.greeting': 'Bonjour {{name}},',
  'mail.instruction.start': 'Début :',
  'mail.instruction.end': 'Fin :',
  'error.service.suspended':
    'L’accès à l’espace de votre club est suspendu : aucune modification n’est possible. Vos données sont conservées. Contactez l’administrateur de votre club ou le prestataire SkyCrew.',
  'error.plan.featureNotIncluded':
    "Cette fonction fait partie de la formule Club + École, que votre club n'a pas choisie.",
  'error.plan.aircraftLimit':
    'Votre formule permet {{max}} avion(s) en service et ce nombre est atteint. Mettez un avion hors service ou contactez votre fournisseur SkyCrew pour changer de formule.',
  'error.plan.memberLimit':
    'Votre formule permet {{max}} membre(s) actif(s) et ce nombre est atteint. Désactivez le compte d’un membre parti ou contactez votre fournisseur SkyCrew pour changer de formule.',
  'error.reservation.licenceRequired':
    "Sans licence valide jusqu'à la fin de ce vol, vous ne pouvez pas réserver : ajoutez votre licence dans votre profil ou demandez à l'administrateur du club de la valider.",
  'error.reservation.instructorRequired':
    "Sans licence valide, vous ne pouvez réserver qu'avec un instructeur : choisissez l'instructeur de ce vol",
  'error.reservation.instructorNoValidLicence':
    "Cet instructeur n'a pas de licence valide jusqu'à la fin de ce vol",
  'error.reservation.instructorNotFound': 'Instructeur introuvable',
  'error.reservation.notAnInstructor':
    "La personne choisie n'est pas un instructeur actif du club",
  'error.reservation.instructorIsPilot':
    "L'instructeur et le pilote doivent être deux personnes différentes",
  'error.reservation.instructorAlreadyBooked':
    'Cet instructeur est déjà pris sur un autre vol à ce moment-là',
  'error.reservation.instructorHasCourse':
    'Cet instructeur donne un cours à un autre élève à ce moment-là',
  'error.reservation.courseNotFound': 'Cours introuvable',
  'error.reservation.courseNotYours':
    "Ce cours n'est pas le vôtre : vous ne pouvez pas réserver d'avion pour lui",
  'error.reservation.courseNotScheduled':
    'Un avion ne se réserve que pour un cours planifié',
  'error.reservation.courseAlreadyBooked':
    'Un avion est déjà réservé pour ce cours',
  'error.reservation.weeklyMaintenance':
    'Ce créneau tombe pendant la maintenance hebdomadaire du club ({{from}}–{{to}}) : choisissez un autre créneau.',
  'error.reservation.courseSlotMismatch':
    'Le créneau de la réservation doit recouvrir celui du cours',

  // Leftovers of the business-rules audit (members, incidents, licences,
  // invoices).
  'error.incident.deleteNotAllowed':
    "Seul un administrateur peut supprimer un incident. Son auteur peut le retirer tant qu'il est ouvert et que personne ne l'a pris en charge.",
  'error.licence.notYours': 'Vous ne pouvez modifier que vos propres licences',
  'error.licence.unknownStatus':
    'Statut de licence inconnu : choisissez active, expirée ou en attente',
  'error.licence.numberAlreadyUsed':
    'Ce numéro est déjà celui d’une autre licence du même type',
  'notification.licenceExpiresIn':
    'Votre licence {{licenceType}} expire dans {{days}} jour(s), le {{date}}. Pensez à la renouveler.',
  'mail.licenceExpiring.subject':
    'Votre licence {{licenceType}} arrive à expiration',
  'notification.licenceDigest':
    '{{count}} licence(s) de membres expirent dans les {{days}} prochains jours (récapitulatif {{month}}).',
  'mail.licenceDigest.subject': 'Licences arrivant à expiration : {{count}}',
  'notification.aircraftGroundedByAudit':
    "L'avion {{registration}} est immobilisé à la suite d'un audit de sécurité non conforme. Votre réservation N°{{reservationId}} du {{date}} est concernée : contactez le club.",
  'notification.aircraftGroundedByAuditStaff':
    "L'avion {{registration}} a été immobilisé à la suite de l'audit de sécurité N°{{auditId}}, non conforme. Réservations à venir concernées : {{count}}.",
  'error.invoice.numberedCannotDelete':
    'Une facture numérotée ne peut pas être supprimée : son numéro manquerait dans la suite de l’année',
  'invoice.title': 'Facture',
  'invoice.fileName': 'facture',
  'invoice.number': 'Facture n° {{number}}',
  'invoice.date': 'Date : {{date}}',
  'invoice.billedTo': 'Facturé à',
  'invoice.description': 'Désignation',
  'invoice.amount': 'Montant',
  'invoice.total': 'Total',
  'invoice.amountPaid': 'Déjà réglé',
  'invoice.balanceDue': 'Reste à payer',
  'invoice.paidBy': 'Mode de règlement : {{method}}',
  'invoice.line.booking':
    "Réservation de l'avion {{registration}}, du {{start}} au {{end}}",
  'invoice.line.instructionBooking':
    "Vol d'instruction sur l'avion {{registration}} avec l'instructeur {{instructor}}, du {{start}} au {{end}}",
  'invoice.line.bookingNumber': 'Réservation N°{{reservationId}}',
  'invoice.line.bookingPlain': "Réservation d'avion",
  'invoice.line.topUp': 'Approvisionnement du compte membre',
  'invoice.line.other': 'Prestation',
  'invoice.method.accountBalance': 'solde du compte membre',
  'invoice.method.card': 'carte bancaire',
  'invoice.method.paypal': 'PayPal',
  'invoice.method.cash': 'espèces',
  'invoice.method.cheque': 'chèque',
  'invoice.method.transfer': 'virement',
  // Flight preparation (navigation data, aircraft data, plans).
  'error.navdata.zoomIn':
    'Trop de points à afficher (plus de {{max}}) : zoomez sur la carte',
  'error.navdata.aerodromeNotFound': "L'aérodrome {{icao}} est introuvable",
  'error.navplan.pointNotFound':
    "Un point de la route n'existe plus dans les données en vigueur",
  'error.navplan.aerodromeRequired':
    'Le départ, la destination et le dégagement doivent être des aérodromes',
  'error.navplan.legsCount':
    'Il faut une branche de plus que de points tournants ({{expected}} attendues)',
  'error.navplan.notOwnPlan':
    'Vous ne pouvez consulter ou modifier que vos propres plans de vol',
  'error.navplan.planNotFound': "Ce plan de vol n'existe pas",
  'error.navplan.aircraftNotBooked':
    "L'avion du plan doit être celui de la réservation",
  'error.navplan.reservationChange':
    "La réservation d'un plan enregistré ne peut pas être changée",
  'error.navplan.reserveBelowAmc':
    'La réserve finale {{label}} ne peut pas être inférieure à {{minimum}} min (AMC1 NCO.OP.125(b))',
  'error.aircraftData.aircraftNotFound': "Cet avion n'existe pas",
  'error.aircraftData.unknownTemplate': 'Modèle inconnu : {{code}}',
  'error.aircraftData.invalidPerformance':
    'Données de performances incorrectes : {{detail}}',
  'error.aircraftData.invalidMassBalance':
    'Données de masse et centrage incorrectes : {{detail}}',
  'error.aircraftData.incomplete':
    "Données de l'avion incomplètes, confirmation impossible : {{missing}}",
  'aircraftData.missing.performance': 'table de croisière',
  'aircraftData.missing.tanks': 'réservoirs (capacité utilisable)',
  'aircraftData.missing.climb':
    'montée (vitesse, taux, débit et plafond, ou table)',
  'aircraftData.missing.descent': 'descente (vitesse, taux et débit)',
  'aircraftData.missing.reserve':
    'débits d’attente et à la puissance maximale continue',
  'aircraftData.missing.massBalance': 'masse et centrage',
  'aircraftData.missing.weighing': 'pesée (masse et bras à vide)',
  'aircraftData.missing.weighingDate': 'date de pesée',
  'aircraftData.missing.mtow': 'masse maximale au décollage',
  'aircraftData.missing.mlw': 'masse maximale à l’atterrissage',
  'aircraftData.missing.seats': 'stations des sièges',
  'aircraftData.missing.envelope': 'enveloppe de centrage',
  'aircraftData.missing.fuelArm': 'bras des réservoirs',
  'navplan.notice.disclaimer':
    'Aide à la préparation du vol. Ne remplace ni les publications aéronautiques officielles (AIP, SUP AIP, NOTAM, cartes VAC), ni le manuel de vol de l’avion, ni le jugement du commandant de bord.',
  'navplan.notice.notamCheck':
    'NOTAM et SUP AIP non intégrés : consultez SOFIA Briefing (https://sofia-briefing.aviation-civile.gouv.fr) et l’activité AZBA du jour avant le départ.',
  'navplan.notice.navdataStale':
    'Données aéronautiques du cycle {{airac}} ({{date}}) PÉRIMÉES — vérifier les publications en vigueur',
  'navplan.notice.noAirspaceData':
    'Aucune donnée d’espace aérien importée : les zones traversées ne sont pas vérifiées',
  'navplan.notice.unverified':
    '{{count}} zone(s) proche(s) de la route sans tracé publié, non vérifiée(s) : {{names}} — repérez-les sur la carte en vigueur',
  'navplan.notice.qnhDefaulted':
    'QNH inconnu : calcul sur 1013,25 hPa, les niveaux de vol et altitudes-pression sont approximatifs',
  'navplan.notice.perfNotValidated':
    'Performances non confirmées par un administrateur : modèle à vérifier avec le manuel de vol de l’avion',
  'navplan.notice.perfMissing':
    'Aucune donnée du manuel de vol pour cet avion : temps et carburant estimés à partir de la fiche flotte, non utilisables pour un vol',
  'navplan.notice.cruiseTemperatureIgnored':
    'Branche {{leg}} : écart ISA {{deviation}} °C non pris en compte (une seule colonne de température dans la table de croisière)',
  'navplan.notice.windExceedsTas':
    'Branche {{leg}} : vent supérieur à la vitesse de l’avion, branche impossible',
  'navplan.notice.performanceOutOfTable':
    'Hors des tables du manuel : {{detail}}',
  'navplan.notice.performanceIncomplete':
    'Données de performances incomplètes : {{detail}}',
  'navplan.notice.wmmExpired':
    'Modèle magnétique expiré (WMM2025 valable jusqu’au 31/12/2029) : routes et caps magnétiques non calculés',
  'navplan.notice.windUnavailable':
    'Pas de prévision de vent en altitude pour une partie de la route : vent nul supposé, saisissez le vent prévu (WINTEM)',
  'navplan.notice.windPilot':
    'Vent saisi par le pilote sur au moins une branche',
  'navplan.notice.nightFlight':
    'Vol en partie de nuit à partir de {{time}} (nuit aéronautique : de la fin du crépuscule civil du soir au début du crépuscule civil du matin, règlement SERA) : réserve finale de nuit (45 min) et qualification de vol de nuit requises',
  'navplan.notice.nightReserveImposed':
    'Vol en partie de nuit à partir de {{time}} (nuit aéronautique : de la fin du crépuscule civil du soir au début du crépuscule civil du matin, règlement SERA) : la réserve finale de nuit (45 min) remplace la réserve de jour choisie ; qualification de vol de nuit requise',
  'navplan.notice.nightApproaching':
    'Arrivée prévue à {{icao}} ({{role}}) à {{arrival}}, {{minutes}} min avant la fin du crépuscule civil ({{dusk}}) : tout retard fera finir le vol de nuit',
  'navplan.notice.qnhMetarOld':
    'QNH issu d’un METAR de {{time}} ({{icao}}), à réactualiser avant le départ',
  'navplan.notice.qnhMetarUnknownTime':
    'QNH issu d’un METAR {{icao}} d’heure inconnue, à réactualiser avant le départ',
  'navplan.notice.tafNotCovering':
    'TAF {{icao}} ({{role}}) valable du {{from}} au {{to}} : il ne couvre pas l’heure prévue ({{time}}), à consulter de nouveau avant le départ',
  'navplan.notice.tafValidityUnknown':
    'TAF {{icao}} ({{role}}) : période de validité illisible, vérifiez qu’il couvre l’heure prévue ({{time}})',
  'navplan.notice.tafMissing':
    'Pas de TAF pour {{icao}} ({{role}}) : aucune prévision pour l’heure prévue ({{time}})',
  'navplan.notice.departureNoForecast':
    'Pas de TAF pour {{icao}} ({{role}}) : le dernier METAR ({{observed}}) ne décrit pas les conditions du départ prévu à {{time}}',
  'navplan.notice.windOutOfRange':
    'Prévision de vent en altitude (run {{run}}) valable du {{from}} au {{to}} : l’heure du vol n’est pas couverte, vent nul supposé sur les branches concernées ; saisissez le vent prévu (WINTEM)',
  'navplan.role.departure': 'départ',
  'navplan.role.destination': 'destination',
  'navplan.role.alternate': 'dégagement',
  'navplan.fuel.alternateRequired':
    'Le club exige un dégagement en VFR : ajoutez un terrain de dégagement',
  'navplan.fuel.aboveUsable':
    '{{loaded}} L embarqués > {{usable}} L utilisables',
  'navplan.fuel.insufficient':
    'Carburant insuffisant : il manque {{missing}} L (minimum au bloc {{minimum}} L)',
  'navplan.fuel.landingBelowReserve':
    'Carburant prévu à l’atterrissage {{landing}} L < réserve finale {{reserve}} L',
  'navplan.fuel.unknownTank': 'Réservoir inconnu : {{tank}}',
  'navplan.fuel.tankAboveUsable':
    '{{tank}} : {{loaded}} L > {{usable}} L utilisables',
  'navplan.fuel.negative': '{{tank}} : quantité négative',
  'navplan.fuel.notComputed': 'Bilan non calculé (voir les avertissements)',
  'navplan.mb.notValidated':
    'Masse et centrage refusés : les données de cet avion (pesée, stations, enveloppe) ne sont pas confirmées par un administrateur',
  'navplan.mb.noEnvelope':
    'Pas d’enveloppe de centrage {{category}} pour cet avion',
  'navplan.mb.noWeighing': 'Pesée de l’avion manquante (masse et bras à vide)',
  'navplan.mb.unknownStation': 'Station de chargement inconnue : {{station}}',
  'navplan.mb.negativeMass': '{{station}} : masse négative',
  'navplan.mb.stationLimit': '{{station}} : {{mass}} kg > {{max}} kg',
  'navplan.mb.aboveMtow':
    'Masse au décollage {{mass}} kg > masse maximale {{max}} kg',
  'navplan.mb.aboveMlw':
    'Masse à l’atterrissage {{mass}} kg > masse maximale à l’atterrissage {{max}} kg',
  'navplan.mb.aboveMzfw':
    'Masse sans carburant {{mass}} kg > maximum {{max}} kg',
  'navplan.mb.cgAft':
    'Centrage arrière hors limites au {{moment}} : {{cg}} m > {{limit}} m ({{mass}} kg)',
  'navplan.mb.cgForward':
    'Centrage avant hors limites au {{moment}} : {{cg}} m < {{limit}} m ({{mass}} kg)',
  'navplan.mb.outOfEnvelope':
    'Hors de l’enveloppe au {{moment}} : {{mass}} kg, centrage {{cg}} m',
  'navplan.mb.pathLeavesEnvelope':
    'Le centrage sort de l’enveloppe entre le décollage et l’atterrissage',
  'navplan.mb.moment.takeoff': 'décollage',
  'navplan.mb.moment.landing': 'atterrissage',
  'navplan.airspace.prohibited': 'Zone interdite : pénétration interdite.',
  'navplan.airspace.restricted':
    'Zone réglementée : pénétration soumise à conditions. Activité : {{activity}} — vérifier l’activité du jour (NOTAM, SUP AIP, AZBA pour le RTBA).',
  'navplan.airspace.danger':
    'Zone dangereuse : activité {{activity}} — vérifier l’activité du jour (NOTAM, SUP AIP).',
  'navplan.airspace.rmz': 'Contact radio obligatoire {{radio}}.',
  'navplan.airspace.rmzNoRadio':
    'Contact radio obligatoire (fréquence : voir la carte en vigueur).',
  'navplan.airspace.sivNoRadio':
    'Service d’information de vol (fréquence : voir la carte en vigueur).',
  'navplan.airspace.clearanceNoRadio':
    'Clairance requise — contacter l’organisme (fréquence : voir la carte en vigueur).',
  'navplan.airspace.tmz': 'Transpondeur obligatoire (mode S).',
  'navplan.airspace.siv': 'Service d’information de vol : {{radio}}.',
  'navplan.airspace.protected':
    'Survol à la hauteur minimale publiée ({{limit}}) — vérifier.',
  'navplan.airspace.classA': 'Classe A : VFR interdit.',
  'navplan.airspace.clearance': 'Clairance requise — contacter {{radio}}.',
  'navplan.airspace.classE':
    'Pas de clairance en VFR ; contact radio et transpondeur selon RMZ/TMZ.',
  'navplan.airspace.other': 'Espace à vérifier sur la carte en vigueur.',
  'navplan.airspace.unverified':
    'Zone non vérifiée : {{name}}, tracé non disponible — la repérer sur la carte en vigueur.',
  'navplan.airspace.unverifiedUnlocated':
    'Zone non vérifiée : {{name}}, tracé non disponible et position non localisable — la repérer sur la carte en vigueur.',
  'navplan.airspace.parachuting':
    'Parachutage jusqu’à {{limit}} (horaires : {{activity}}) — s’écarter de la zone ou s’informer de l’activité auprès de l’organisme ; ne pas la survoler sans contact.',
  'navplan.airspace.aerobatics':
    'Zone de voltige jusqu’à {{limit}} (horaires : {{activity}}) — l’éviter quand elle est active.',
  'navplan.airspace.winch':
    'Treuillage (câble) jusqu’à {{limit}} (horaires : {{activity}}) — ne pas survoler en dessous de cette altitude.',
  'navplan.airspace.balloon':
    'Ballon captif (câble) jusqu’à {{limit}} (horaires : {{activity}}) — ne pas survoler en dessous de cette altitude.',
  'navplan.airspace.lowOverflight':
    'Survol à basse altitude interdit : rester au-dessus de {{limit}} (monomoteurs à pistons ; plus haut pour les autres aéronefs, voir les consignes).',
  'navplan.airspace.modelAircraft':
    'Aéromodélisme jusqu’à {{limit}} (horaires : {{activity}}) — veille visuelle.',
  'navplan.airspace.drone':
    'Activité de drones jusqu’à {{limit}} (horaires : {{activity}}) — veille visuelle.',
  'navplan.notice.obstacleMargin':
    '{{count}} obstacle(s) à moins de {{corridor}} NM de la route culminent à moins de {{margin}} ft sous l’altitude prévue (le plus haut par rapport à l’altitude : {{amsl}} ft, branche vers {{point}}) — voir les branches et relever l’altitude si besoin.',
  'navplan.notice.aerodromeRestricted':
    '{{icao}} ({{role}}) est à usage restreint : autorisation préalable de l’exploitant (voir la fiche terrain et la VAC).',
  'navplan.notice.aerodromePrivate':
    '{{icao}} ({{role}}) est un aérodrome privé : accord du propriétaire nécessaire.',
  'navplan.notice.aerodromeMilitary':
    '{{icao}} ({{role}}) est un aérodrome militaire : accès soumis à autorisation (PPR).',
  'navplan.notice.aerodromeNoVfr':
    '{{icao}} ({{role}}) n’est pas ouvert au trafic VFR selon le SIA : vérifier la VAC.',
  'navplan.notice.msaBelow':
    '{{leg}} : altitude prévue {{altitude}} ft, sous l’altitude minimale de sécurité de {{msa}} ft (de {{below}} ft). Point culminant {{highest}} ft à moins de {{corridor}} NM de la route, marge du club {{margin}} ft : relever l’altitude de la branche.',
  'navplan.notice.msaUnknown':
    'Altitude minimale de sécurité inconnue ({{legs}}) : la route sort de la couverture du relief (France métropolitaine, Corse et leurs abords). La déterminer sur la carte.',
  'navplan.notice.distanceDataMissing':
    'Distances de décollage et d’atterrissage non renseignées pour cet avion : à saisir depuis le manuel de vol (données de vol de l’avion). Les distances des pistes ne sont pas vérifiées.',
  'navplan.notice.distanceNoRunway':
    '{{icao}} ({{role}}) : pistes inconnues, distances non vérifiées. Voir la VAC.',
  'navplan.notice.takeoffDistanceExceeded':
    'Décollage de {{icao}} piste {{runway}} : {{required}} m nécessaires (passage des 15 m, facteurs compris) pour {{available}} m disponibles.',
  'navplan.notice.takeoffDistanceCheck':
    'Décollage de {{icao}} piste {{runway}} à vérifier : {{required}} m nécessaires (facteurs compris) pour {{available}} m disponibles (voir la fiche terrain).',
  'navplan.notice.landingDistanceExceeded':
    'Atterrissage à {{icao}} ({{role}}) piste {{runway}} : {{required}} m nécessaires (depuis 15 m, facteurs compris) pour {{available}} m disponibles.',
  'navplan.notice.landingDistanceCheck':
    'Atterrissage à {{icao}} ({{role}}) piste {{runway}} à vérifier : {{required}} m nécessaires (facteurs compris) pour {{available}} m disponibles (voir la fiche terrain).',
  'navplan.distance.noTable':
    'Non renseigné : à saisir depuis le manuel de vol.',
  'navplan.distance.outOfTable':
    'Hors du tableau du manuel : la valeur du bord du tableau est retenue, la distance réelle est plus longue.',
  'navplan.distance.unpavedAsGrass':
    'Piste non revêtue : facteurs de l’herbe retenus.',
  'navplan.distance.surfaceUnknown':
    'Revêtement inconnu : facteurs de l’herbe retenus.',
  'navplan.distance.slopeUnknown':
    'Pente inconnue (altitudes des seuils non publiées) : non prise en compte.',
  'navplan.distance.windUnknown':
    'Vent inconnu (pas de METAR) : aucun vent pris en compte.',
  'navplan.distance.tailwindNotCorrected':
    'Vent arrière de {{tailwind}} kt non corrigé : saisir la vitesse du tableau (ou la correction du manuel) dans les données de l’avion.',
  'navplan.distance.isaConditions':
    'Pas de METAR : température et pression de l’atmosphère standard (ISA) retenues. À refaire avec la météo du jour.',
  'navplan.distance.massMaximum':
    'Masse et centrage non calculés : masse maximale retenue.',
  'navplan.distance.massUnknown':
    'Masse inconnue : la masse la plus forte du tableau est retenue.',
  'navplan.distance.availableUnknown':
    'Distances disponibles non publiées : vérifier sur la VAC.',
  'navplan.distance.lengthAsDeclared':
    'Distance déclarée non publiée : longueur de la piste retenue.',
  'navplan.distance.noRunway': 'Aucune piste connue.',
  'navplan.distance.factor.grass': 'Herbe sèche',
  'navplan.distance.factor.wetGrass': 'Herbe mouillée',
  'navplan.distance.factor.slope': 'Pente',
  'navplan.distance.factor.headwind': 'Vent de face (50 % crédité)',
  'navplan.distance.factor.tailwind': 'Vent arrière',
  'navplan.distance.factor.safety': 'Coefficient de sécurité du club',
  'navplan.distance.source.MANUAL': 'manuel de vol',
  'navplan.distance.source.CAA_SSL7':
    'facteur générique UK CAA Safety Sense Leaflet 7',
  'navplan.distance.source.CLUB': 'club',
  'navplan.pdf.col.msa': 'MSA',
  'navplan.pdf.msaNotice':
    'MSA : point culminant (relief ou obstacle) à moins de {{corridor}} NM de la route + {{margin}} ft, arrondi à la centaine supérieure ; « ? » : hors de la couverture du relief.',
  'navplan.pdf.distances.takeoff':
    'Décollage — masse {{mass}} kg, Zp {{pa}} ft, {{temperature}} °C ({{conditions}}), coefficient {{factor}}',
  'navplan.pdf.distances.landing':
    'Atterrissage — masse {{mass}} kg, Zp {{pa}} ft, {{temperature}} °C ({{conditions}}), coefficient {{factor}}',
  'navplan.pdf.distances.missing':
    'Distances non renseignées : à saisir depuis le manuel de vol.',
  'navplan.pdf.dist.runway': 'Piste',
  'navplan.pdf.dist.conditions': 'Revêtement, pente, vent',
  'navplan.pdf.dist.table': 'Manuel roul. / 15 m',
  'navplan.pdf.dist.factors': 'Facteurs',
  'navplan.pdf.dist.required': 'Nécessaire roul. / 15 m',
  'navplan.pdf.dist.availableTakeoff': 'TORA / TODA',
  'navplan.pdf.dist.availableLanding': 'LDA',
  'navplan.pdf.dist.margin': 'Marge',
  'navplan.pdf.dist.status': 'Statut',
  'navplan.pdf.dist.factor.grass': 'herbe',
  'navplan.pdf.dist.factor.wetGrass': 'herbe mouillée',
  'navplan.pdf.dist.factor.slope': 'pente',
  'navplan.pdf.dist.factor.headwind': 'vent de face',
  'navplan.pdf.dist.factor.tailwind': 'vent arrière',
  'navplan.pdf.dist.factor.safety': 'club',
  'navplan.pdf.dist.status.OK': 'OK',
  'navplan.pdf.dist.status.WARNING': 'À VÉRIFIER',
  'navplan.pdf.dist.status.BLOCKING': 'BLOQUANT',
  'navplan.pdf.dist.wet': 'mouillée',
  'navplan.airspace.checkHeight':
    'Limite exprimée en hauteur sol : vérifier sur la carte. Activité inconnue ≠ zone inactive.',
  'navplan.aerodrome.status.CAP':
    'Ouvert à la circulation aérienne publique (CAP)',
  'navplan.aerodrome.status.RST':
    'Usage restreint : autorisation préalable de l’exploitant',
  'navplan.aerodrome.status.PRV': 'Aérodrome privé : accord du propriétaire',
  'navplan.aerodrome.status.MIL':
    'Aérodrome militaire : accès sur autorisation (PPR)',
  'navplan.aerodrome.status.OFF':
    'Pas un aérodrome (organisme, centre de contrôle)',
  'navplan.pdf.aerodromes': 'Terrains',
  'navplan.pdf.rwy.qfu': 'Piste / QFU',
  'navplan.pdf.rwy.tora': 'TORA',
  'navplan.pdf.rwy.lda': 'LDA',
  'navplan.pdf.rwy.size': 'Dimensions, revêtement',
  'navplan.pdf.rwy.wind': 'Vent METAR (* piste conseillée)',
  'navplan.pdf.rwy.components': '{{head}}, travers {{cross}}',
  'navplan.pdf.rwy.head': 'kt face',
  'navplan.pdf.rwy.tail': 'kt arrière',
  'navplan.pdf.rwy.right': 'kt de droite',
  'navplan.pdf.rwy.left': 'kt de gauche',
  'navplan.pdf.atsHours': 'Horaires ATS',
  'navplan.pdf.fuelAvailable': 'Carburant',
  'navplan.pdf.fuelNone': 'aucun publié',
  'navplan.pdf.metarConditions':
    'METAR : vent {{wind}}, {{temperature}} °C, QNH {{qnh}} — altitude densité {{da}} ft',
  'navplan.pdf.hours': 'Horaires',
  'navplan.pdf.obstacles':
    'Obstacles à moins de 500 ft sous l’altitude prévue, {{leg}} :',
  'navplan.pdf.freezing': 'Isotherme 0 °C (prévision ICON-EU)',
  'navplan.pdf.freezing.route': 'mi-parcours',
  'navplan.pdf.freezing.surface': 'au sol',
  'navplan.pdf.relation.INSIDE': 'dans la zone',
  'navplan.pdf.relation.NEAR_FLOOR': 'près du plancher',
  'navplan.pdf.relation.NEAR_CEILING': 'près du plafond',
  'navplan.pdf.relation.UNKNOWN_VERTICAL': 'hauteur à vérifier',
  'navplan.pdf.relation.BELOW': 'en dessous',
  'navplan.pdf.relation.ABOVE': 'au-dessus',
  'navplan.pdf.title': 'Dossier de vol',
  'navplan.pdf.navLog': 'Log de navigation',
  'navplan.pdf.aircraft': 'Avion',
  'navplan.pdf.pilot': 'Pilote',
  'navplan.pdf.date': 'Date (UTC)',
  'navplan.pdf.route': 'Route',
  'navplan.pdf.qnh': 'QNH',
  'navplan.pdf.navdata': 'Données aéronautiques',
  'navplan.pdf.winds': 'Vents',
  'navplan.pdf.status': 'Statut',
  'navplan.pdf.blocking': 'HORS LIMITES — NE PAS PARTIR',
  'navplan.pdf.warning': 'Points à vérifier avant le départ',
  'navplan.pdf.ok': 'Aucun point bloquant relevé',
  'navplan.pdf.col.point': 'Point',
  'navplan.pdf.col.alt': 'Alt ft',
  'navplan.pdf.col.tc': 'Rv',
  'navplan.pdf.col.mc': 'Rm',
  'navplan.pdf.col.wind': 'Vent',
  'navplan.pdf.col.wca': 'Dér.',
  'navplan.pdf.col.mh': 'Cm',
  'navplan.pdf.col.tas': 'Vp',
  'navplan.pdf.col.gs': 'Vs',
  'navplan.pdf.col.dist': 'Dist',
  'navplan.pdf.col.cumDist': 'Cumul',
  'navplan.pdf.col.time': 'Tps',
  'navplan.pdf.col.cumTime': 'Cumul',
  'navplan.pdf.col.eta': 'HE',
  'navplan.pdf.col.ata': 'HR',
  'navplan.pdf.col.fuel': 'Carb. L',
  'navplan.pdf.col.fuelActual': 'Réel',
  'navplan.pdf.col.radio': 'Fréquences / zones',
  'navplan.pdf.fuel': 'Bilan carburant',
  'navplan.pdf.fuel.taxi': 'Roulage',
  'navplan.pdf.fuel.trip': 'Délestage',
  'navplan.pdf.fuel.contingency': 'Aléas',
  'navplan.pdf.fuel.alternate': 'Dégagement',
  'navplan.pdf.fuel.reserve': 'Réserve finale ({{minutes}} min)',
  'navplan.pdf.fuel.margin': 'Marge club',
  'navplan.pdf.fuel.minimum': 'Minimum au bloc',
  'navplan.pdf.fuel.loaded': 'Embarqué',
  'navplan.pdf.fuel.extra': 'Supplément',
  'navplan.pdf.fuel.landing': 'Prévu à l’atterrissage',
  'navplan.pdf.fuel.endurance': 'Autonomie',
  'navplan.pdf.mb': 'Masse et centrage',
  'navplan.pdf.mb.station': 'Station',
  'navplan.pdf.mb.mass': 'Masse kg',
  'navplan.pdf.mb.arm': 'Bras m',
  'navplan.pdf.mb.moment': 'Moment kg·m',
  'navplan.pdf.mb.takeoff': 'Décollage',
  'navplan.pdf.mb.landing': 'Atterrissage',
  'navplan.pdf.mb.empty': 'Avion à vide',
  'navplan.pdf.mb.notice':
    'Calcul établi à partir des données saisies par le club (pesée du {{date}}). Le commandant de bord vérifie avec le manuel de vol.',
  'navplan.pdf.airspaces': 'Zones traversées',
  'navplan.pdf.airspaces.none':
    'Aucune zone traversée dans les données en vigueur',
  'navplan.pdf.airspaces.notChecked':
    "Zones non vérifiées : aucune donnée d'espace aérien importée. Repérer les zones traversées sur la carte aéronautique en vigueur (carte OACI, VAC, AIP).",
  'navplan.pdf.weather': 'Météo (METAR / TAF bruts, aviationweather.gov)',
  'navplan.pdf.notices': 'Avertissements',
  'navplan.pdf.links':
    'NOTAM : https://sofia-briefing.aviation-civile.gouv.fr — Activité RTBA : page AZBA du SIA. NOTAM et SUP AIP consultés : [ ]',
  'navplan.pdf.page': 'Page {{page}}',
  'navplan.pdf.forecastNotice':
    'Prévision automatique non validée par un prévisionniste.',
  'navplan.pdf.qnhSource.METAR': 'METAR {{icao}} de {{time}}',
  'navplan.pdf.qnhSource.INPUT': 'saisi par le pilote',
  'navplan.pdf.qnhSource.DEFAULT': 'QNH inconnu, atmosphère standard',
  'navplan.pdf.navdata.airac': 'cycle AIRAC {{airac}} du {{date}}',
  'navplan.pdf.navdata.ourairports':
    'données aérodromes OurAirports du {{date}}, pas de cycle AIRAC',
  'navplan.pdf.navdata.none': 'aucune donnée aéronautique importée',
  'navplan.pdf.navdata.stale': 'PÉRIMÉES',
  'navplan.pdf.sun': 'Soleil (UTC)',
  'navplan.pdf.sun.line':
    '{{icao}} ({{role}}, {{date}}) : début du crépuscule civil {{dawn}}, lever {{sunrise}}, coucher {{sunset}}, fin du crépuscule civil {{dusk}}',
  'navplan.pdf.sun.night':
    'Vol en partie de nuit à partir de {{time}} : réserve finale de nuit (45 min).',
  'navplan.pdf.sun.day':
    'Vol entièrement de jour (nuit aéronautique : de la fin du crépuscule civil du soir au début du crépuscule civil du matin).',
  'navplan.pdf.windNone': '* pas de prévision de vent : vent nul supposé',
  'navplan.pdf.status.OK': 'INFO',
  'navplan.pdf.status.WARNING': 'ATTENTION',
  'navplan.pdf.status.BLOCKING': 'BLOQUANT',
} as const;

export type TranslationKey = keyof typeof fr;
