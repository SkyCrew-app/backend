import { DataSource } from 'typeorm';
import { InstructionCourse } from '../../modules/instruction-courses/entity/instruction-courses.entity';
import { CourseCompetency } from '../../modules/instruction-courses/entity/course-competency.entity';
import { CourseComment } from '../../modules/instruction-courses/entity/course-comment.entity';
import { CourseStatus } from '../../modules/instruction-courses/enum/course-status.enum';
import { User } from '../../modules/users/entity/users.entity';

export const seedDemoInstruction = async (
  dataSource: DataSource,
  users: User[],
): Promise<void> => {
  const courseRepo = dataSource.getRepository(InstructionCourse);
  const competencyRepo = dataSource.getRepository(CourseCompetency);
  const commentRepo = dataSource.getRepository(CourseComment);

  const now = new Date();
  const instructeurs = [users[2], users[6]]; // Marie, Camille
  const admin = users[0];
  const eleves = [users[8], users[4], users[1]]; // Emma, Sophie, Jean

  const makeDate = (daysOffset: number, hours: number, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const courses = [
    // ============ Cours ADMIN - perfectionnement ============
    {
      instructor: instructeurs[0], // Marie
      student: admin,
      startTime: makeDate(-40, 9, 0),
      endTime: makeDate(-40, 12, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Excellente maîtrise. Les procédures IFR sont parfaitement exécutées. Admin est prêt pour la qualification IR.',
      rating: 5,
      competencies: [
        { name: 'Approche ILS', description: 'Exécution d\'une approche ILS avec suivi du localizer et du glide', validated: true },
        { name: 'Approche VOR/DME', description: 'Approche classique VOR/DME non précision', validated: true },
        { name: 'Tenue d\'axe et de plan', description: 'Précision du suivi d\'axe et de plan en approche', validated: true },
        { name: 'Remise de gaz IFR', description: 'Procédure de remise de gaz en conditions IFR', validated: true },
      ],
      comments: [
        { author: instructeurs[0], content: 'Séance de perfectionnement IFR. 3 approches ILS + 1 VOR/DME. Excellente précision sur tous les exercices.', daysAgo: 40 },
        { author: admin, content: 'Bonne séance, je me sens de plus en plus à l\'aise aux instruments.', daysAgo: 40 },
      ],
    },
    {
      instructor: instructeurs[1], // Camille
      student: admin,
      startTime: makeDate(-20, 8, 0),
      endTime: makeDate(-20, 11, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Vol de navigation longue distance maîtrisé. Bonne gestion du carburant et des aléas météo. RAS.',
      rating: 5,
      competencies: [
        { name: 'Navigation longue distance', description: 'Planification et exécution d\'un vol > 300nm', validated: true },
        { name: 'Gestion carburant', description: 'Calcul et suivi de la consommation en vol', validated: true },
        { name: 'Déroutement météo', description: 'Décision et exécution d\'un déroutement pour cause météo', validated: true },
      ],
      comments: [
        { author: instructeurs[1], content: 'Navigation LFPG-LFBO aller-retour. Déroutement simulé vers LFBL. Parfaite gestion.', daysAgo: 20 },
      ],
    },
    {
      instructor: instructeurs[0], // Marie
      student: admin,
      startTime: makeDate(-8, 14, 0),
      endTime: makeDate(-8, 16, 30),
      status: CourseStatus.COMPLETED,
      feedback: 'Entraînement pannes moteur en différentes configurations. Tous les exercices réussis du premier coup.',
      rating: 4,
      competencies: [
        { name: 'Panne moteur après décollage', description: 'Gestion de la panne moteur en montée initiale', validated: true },
        { name: 'Panne en croisière', description: 'Choix du terrain et procédure d\'atterrissage forcé', validated: true },
        { name: 'Panne électrique', description: 'Gestion de la panne électrique totale', validated: true },
      ],
      comments: [
        { author: instructeurs[0], content: 'Séance pannes et urgences. 3 pannes moteur simulées + 1 panne électrique. Réactions rapides et appropriées.', daysAgo: 8 },
        { author: admin, content: 'La panne après décollage reste l\'exercice le plus stressant mais je gère bien maintenant.', daysAgo: 8 },
      ],
    },
    // ============ Cours terminés (autres élèves) ============
    {
      instructor: instructeurs[0], // Marie
      student: eleves[0], // Emma
      startTime: makeDate(-30, 9, 0),
      endTime: makeDate(-30, 11, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Excellent premier vol. Emma montre de bonnes aptitudes naturelles. Les bases du pilotage (assiette, inclinaison) sont bien comprises. À travailler : la coordination pieds-mains en virage.',
      rating: 4,
      competencies: [
        { name: 'Roulage au sol', description: 'Maîtrise du roulage, utilisation des freins et du palonnier', validated: true },
        { name: 'Décollage', description: 'Procédure de décollage normal face au vent', validated: true },
        { name: 'Vol en palier', description: 'Maintien d\'altitude et de cap en vol rectiligne stabilisé', validated: true },
        { name: 'Virages à 30°', description: 'Virages coordonnés à 30° d\'inclinaison', validated: false },
      ],
      comments: [
        { author: instructeurs[0], content: 'Première leçon de vol. Briefing sol complet (30min) + 1h30 de vol. Découverte de l\'environnement aéronautique.', daysAgo: 30 },
        { author: eleves[0], content: 'Super expérience ! J\'ai hâte de continuer. Le décollage était impressionnant.', daysAgo: 30 },
      ],
    },
    {
      instructor: instructeurs[0], // Marie
      student: eleves[0], // Emma
      startTime: makeDate(-23, 9, 0),
      endTime: makeDate(-23, 11, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Bonne progression. Les virages à 30° sont maintenant coordonnés. Introduction aux virages à 45° et au vol lent. Emma gère bien le stress.',
      rating: 4,
      competencies: [
        { name: 'Virages à 30°', description: 'Virages coordonnés à 30° d\'inclinaison', validated: true },
        { name: 'Virages à 45°', description: 'Virages serrés à 45° d\'inclinaison', validated: false },
        { name: 'Vol lent', description: 'Vol à vitesse réduite, approche du décrochage', validated: true },
      ],
      comments: [
        { author: instructeurs[0], content: 'Leçon 2 : Virages et vol lent. Bonne progression, Emma est à l\'aise avec les commandes.', daysAgo: 23 },
      ],
    },
    {
      instructor: instructeurs[0], // Marie
      student: eleves[0], // Emma
      startTime: makeDate(-16, 9, 0),
      endTime: makeDate(-16, 11, 30),
      status: CourseStatus.COMPLETED,
      feedback: 'Leçon dédiée aux atterrissages. 6 tours de piste effectués. Les 3 derniers atterrissages étaient bien stabilisés. Prochaine étape : vent de travers.',
      rating: 5,
      competencies: [
        { name: 'Circuit de piste', description: 'Intégration et exécution du circuit de piste (vent arrière, base, finale)', validated: true },
        { name: 'Atterrissage normal', description: 'Atterrissage stabilisé avec arrondi et toucher corrects', validated: true },
        { name: 'Remise de gaz', description: 'Procédure de remise de gaz en cas d\'approche non stabilisée', validated: true },
      ],
      comments: [
        { author: instructeurs[0], content: 'Excellente séance ! 6 TDP. Les 3 derniers posés étaient très propres. Emma est prête pour le vent de travers.', daysAgo: 16 },
        { author: eleves[0], content: 'Je commence à sentir l\'arrondi ! Le 5ème atterrissage était le meilleur.', daysAgo: 16 },
      ],
    },
    {
      instructor: instructeurs[0], // Marie
      student: eleves[0], // Emma
      startTime: makeDate(-3, 8, 0),
      endTime: makeDate(-3, 10, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Vent de travers 310/15G22. Conditions idéales pour l\'exercice. 8 atterrissages effectués. Les corrections au vent sont de mieux en mieux gérées.',
      rating: 4,
      competencies: [
        { name: 'Atterrissage vent de travers', description: 'Technique de décrabé ou d\'aile basse en vent de travers', validated: true },
        { name: 'Gestion du vent', description: 'Adaptation de la trajectoire et de la vitesse selon le vent', validated: true },
      ],
      comments: [
        { author: instructeurs[0], content: 'Leçon 12 - Vent de travers. Vent 310/15G22 parfait pour l\'exercice. 8 TDP. Bonnes corrections.', daysAgo: 3 },
        { author: eleves[0], content: 'C\'était intense avec les rafales ! Mais je commence à bien gérer la dérive.', daysAgo: 3 },
      ],
    },
    // ============ Cours avec Camille et Sophie ============
    {
      instructor: instructeurs[1], // Camille
      student: eleves[1], // Sophie
      startTime: makeDate(-10, 14, 0),
      endTime: makeDate(-10, 16, 30),
      status: CourseStatus.COMPLETED,
      feedback: 'Séance de perfectionnement navigation. Sophie maîtrise bien le cheminement et l\'estime. À revoir : la gestion du carburant en navigation et le log de nav.',
      rating: 3,
      competencies: [
        { name: 'Navigation à l\'estime', description: 'Calcul de cap, vitesse sol et temps de vol', validated: true },
        { name: 'Cheminement', description: 'Navigation visuelle en suivant des repères au sol', validated: true },
        { name: 'Log de navigation', description: 'Tenue du log de nav en vol (temps, caps, carburant)', validated: false },
        { name: 'Déroutement', description: 'Procédure de déroutement vers un terrain de dégagement', validated: true },
      ],
      comments: [
        { author: instructeurs[1], content: 'Navigation LFLL - LFLP - LFLL. Sophie se repère bien visuellement mais doit mieux tenir son log de nav.', daysAgo: 10 },
        { author: eleves[1], content: 'La nav c\'est génial ! Par contre j\'oublie de noter les temps de passage...', daysAgo: 10 },
      ],
    },
    {
      instructor: instructeurs[1], // Camille
      student: eleves[2], // Jean - perfectionnement
      startTime: makeDate(-15, 10, 0),
      endTime: makeDate(-15, 12, 0),
      status: CourseStatus.COMPLETED,
      feedback: 'Séance de perfectionnement IFR en conditions simulées. Jean progresse bien, les approches ILS sont de mieux en mieux.',
      rating: 4,
      competencies: [
        { name: 'Approche ILS', description: 'Exécution d\'une approche ILS avec suivi du localizer et du glide', validated: true },
        { name: 'Tenue de trajectoire sous capote', description: 'Vol aux instruments avec vue extérieure masquée', validated: true },
        { name: 'Procédure d\'attente', description: 'Hippodrome d\'attente sur un point publié', validated: false },
      ],
      comments: [
        { author: instructeurs[1], content: 'Perfectionnement IFR. 2 approches ILS + 1 hippodrome. Jean doit travailler les procédures d\'attente.', daysAgo: 15 },
      ],
    },
    // ============ Cours planifié (futur) ============
    {
      instructor: instructeurs[0], // Marie
      student: eleves[0], // Emma
      startTime: makeDate(3, 14, 0),
      endTime: null,
      status: CourseStatus.SCHEDULED,
      feedback: null,
      rating: null,
      competencies: [
        { name: 'Navigation à vue', description: 'Premier vol de navigation autonome avec instructeur', validated: false },
        { name: 'Radionavigation VOR', description: 'Utilisation du VOR pour la navigation', validated: false },
        { name: 'Lecture de carte OACI', description: 'Utilisation de la carte en vol', validated: false },
      ],
      comments: [
        { author: instructeurs[0], content: 'Prochaine leçon : premier vol de navigation. Préparer la nav LFRS-LFRN (Nantes-Rennes) sur carte OACI.', daysAgo: 1 },
        { author: eleves[0], content: 'J\'ai commencé à tracer la route sur la carte. J\'ai calculé un cap magnétique de 045° pour la première branche.', daysAgo: 0 },
      ],
    },
    // ============ Cours en cours ============
    {
      instructor: instructeurs[1], // Camille
      student: eleves[1], // Sophie
      startTime: makeDate(0, 14, 0),
      endTime: null,
      status: CourseStatus.IN_PROGRESS,
      feedback: null,
      rating: null,
      competencies: [
        { name: 'Pannes moteur simulées', description: 'Gestion de la panne moteur en différentes phases de vol', validated: false },
        { name: 'Atterrissage en campagne', description: 'Choix du terrain et procédure d\'atterrissage forcé', validated: false },
      ],
      comments: [
        { author: instructeurs[1], content: 'Séance pannes et procédures d\'urgence. Prévoir 2h30 de vol.', daysAgo: 2 },
      ],
    },
  ];

  for (const courseData of courses) {
    const { competencies, comments, ...courseFields } = courseData;

    const course = courseRepo.create(courseFields);
    const savedCourse = await courseRepo.save(course);

    for (const compData of competencies) {
      const competency = competencyRepo.create({
        ...compData,
        course: savedCourse,
      });
      await competencyRepo.save(competency);
    }

    for (const commentData of comments) {
      const comment = commentRepo.create({
        content: commentData.content,
        author: commentData.author,
        course: savedCourse,
        creationDate: makeDate(-commentData.daysAgo, 12, 0),
      });
      await commentRepo.save(comment);
    }
  }

  console.log(`${courses.length} demo instruction courses with competencies and comments created`);
};
