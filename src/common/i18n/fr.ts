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
  'notification.withdrawal':
    'Un paiement de {{amount}} a été effectué sur votre compte',
  'notification.invoiceCreated': 'Une facture de {{amount}} a été créée',
  'notification.paymentReceived':
    'Un ajout de {{amount}} a été effectué sur votre compte',
  'notification.paymentRefunded':
    'Un remboursement de {{amount}} a été effectué sur votre compte',
  'notification.courseCreatedForStudent':
    "Votre cours avec l'instructeur {{instructorId}} a été créé.",
  'notification.courseCreatedForInstructor':
    "Votre cours avec l'étudiant {{studentId}} a été créé.",
  'notification.competencyValidated':
    'Une compétence a été validée dans votre cours.',
  'notification.courseComment': 'Un commentaire a été ajouté à votre cours.',
  'notification.courseCompleted': 'Votre cours {{courseId}} est terminé.',
  'notification.flightPlanCreated':
    'Votre plan de vol de {{origin}} a {{destination}} a ete cree',
  'notification.flightPlanGenerated':
    'Votre plan de vol de {{origin}} a {{destination}} a ete genere automatiquement',
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
  'error.reservation.noClubSettings':
    "Aucune configuration d'administration trouvée",
  'error.reservation.noValidLicence':
    "Vous n'avez pas de licence valide pour réserver cet avion",
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
} as const;

export type TranslationKey = keyof typeof fr;
