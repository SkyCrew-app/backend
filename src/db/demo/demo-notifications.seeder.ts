import { DataSource } from 'typeorm';
import { Notification } from '../../modules/notifications/entity/notifications.entity';
import { User } from '../../modules/users/entity/users.entity';

export const seedDemoNotifications = async (
  dataSource: DataSource,
  users: User[],
): Promise<void> => {
  const notificationRepository = dataSource.getRepository(Notification);

  const now = new Date();

  const demoNotifications = [
    // Demo admin (users[0])
    {
      user: users[0],
      notification_type: 'maintenance',
      message: 'Le Tecnam P2002 (F-HMTX) est en maintenance jusqu\'au ' + new Date(now.getTime() + 3 * 24 * 3600000).toLocaleDateString('fr-FR'),
      notification_date: new Date(now.getTime() - 2 * 24 * 3600000),
      is_read: false,
      priority: 'haute',
      action_url: '/maintenance',
    },
    {
      user: users[0],
      notification_type: 'incident',
      message: 'Nouvel incident signalé : bird strike sur Robin DR400 (F-GAER). Action requise.',
      notification_date: new Date(now.getTime() - 5 * 24 * 3600000),
      is_read: false,
      priority: 'haute',
      action_url: '/incidents',
    },
    {
      user: users[0],
      notification_type: 'paiement',
      message: 'Facture en attente de paiement pour Emma Girard : 290,00€',
      notification_date: new Date(now.getTime() - 3 * 24 * 3600000),
      is_read: true,
      priority: 'moyenne',
      action_url: '/invoices',
    },
    {
      user: users[0],
      notification_type: 'système',
      message: 'Bienvenue sur le mode démonstration de SkyCrew ! Explorez librement toutes les fonctionnalités.',
      notification_date: now,
      is_read: false,
      priority: 'basse',
    },
    // Jean (users[1])
    {
      user: users[1],
      notification_type: 'réservation',
      message: 'Votre réservation du Cessna 172 (F-GSKY) est confirmée pour demain à 09h00.',
      notification_date: now,
      is_read: false,
      priority: 'moyenne',
      action_url: '/reservations',
    },
    {
      user: users[1],
      notification_type: 'licence',
      message: 'Rappel : votre qualification SEP expire dans 90 jours. Pensez à planifier votre prorogation.',
      notification_date: new Date(now.getTime() - 1 * 24 * 3600000),
      is_read: false,
      priority: 'moyenne',
    },
    // Sophie (users[4])
    {
      user: users[4],
      notification_type: 'licence',
      message: 'Attention : votre licence PPL expire dans 30 jours ! Contactez un instructeur pour renouvellement.',
      notification_date: now,
      is_read: false,
      priority: 'haute',
    },
    {
      user: users[4],
      notification_type: 'réservation',
      message: 'Votre réservation du Piper PA-28 pour un vol découverte est confirmée.',
      notification_date: new Date(now.getTime() - 1 * 24 * 3600000),
      is_read: true,
      priority: 'basse',
      action_url: '/reservations',
    },
    // Emma (users[8])
    {
      user: users[8],
      notification_type: 'formation',
      message: 'Nouvelle leçon disponible : "Navigation à vue" dans le cours Fondamentaux du pilotage VFR.',
      notification_date: new Date(now.getTime() - 2 * 24 * 3600000),
      is_read: false,
      priority: 'basse',
      action_url: '/e-learning',
    },
    {
      user: users[8],
      notification_type: 'paiement',
      message: 'Facture de 290,00€ en attente de paiement. Échéance dans 14 jours.',
      notification_date: new Date(now.getTime() - 3 * 24 * 3600000),
      is_read: false,
      priority: 'moyenne',
      action_url: '/invoices',
    },
    // Lucas (users[5])
    {
      user: users[5],
      notification_type: 'article',
      message: 'Nouvel article : "Résultats du rallye aérien inter-clubs". Bravo pour votre 2ème place !',
      notification_date: new Date(now.getTime() - 15 * 24 * 3600000),
      is_read: true,
      priority: 'basse',
      action_url: '/articles',
    },
    // Marie instructeur (users[2])
    {
      user: users[2],
      notification_type: 'réservation',
      message: 'Nouvelle demande de cours : Emma Girard souhaite la leçon 13 (navigation à vue).',
      notification_date: new Date(now.getTime() - 1 * 24 * 3600000),
      is_read: false,
      priority: 'moyenne',
      action_url: '/reservations',
    },
  ];

  for (const data of demoNotifications) {
    const notification = notificationRepository.create(data);
    await notificationRepository.save(notification);
  }

  console.log(`${demoNotifications.length} demo notifications created`);
};
