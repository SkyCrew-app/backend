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
} as const;

export type TranslationKey = keyof typeof fr;
