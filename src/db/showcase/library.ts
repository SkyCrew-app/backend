import { AuditCategoryType } from '../../modules/audit/enums/audit-category.enum';
import { CriticalityLevel } from '../../modules/audit/enums/criticality-level.enum';
import { ChecklistCategory } from '../../modules/checklists/entity/checklist-item.entity';

// Club content of the showcase: news, e-learning, check-lists, audits.

// days: when it was written, relative to today (negative: in the past).
// event: the day of the event it announces, relative to today.
export const ARTICLES: {
  days: number;
  event?: number;
  title: string;
  description: string;
  text: string;
  tags: string[];
}[] = [
  {
    days: -170,
    title: 'Reprise de la saison : les nouveautés',
    description: 'Tarifs, planning et rappels pour bien démarrer la saison.',
    text: 'La saison reprend ! Les tarifs horaires évoluent légèrement pour suivre le prix du carburant. Pensez à vérifier la validité de vos licences et certificats médicaux avant votre premier vol, et à refaire un vol avec instructeur si vous n’avez pas volé depuis plus de trois mois.',
    tags: ['club', 'tarifs'],
  },
  {
    days: -128,
    event: -114,
    title: 'Journée portes ouvertes',
    description: 'Baptêmes de l’air et découverte du club pour le public.',
    text: 'Le club ouvre ses portes au public : baptêmes de l’air, visite du hangar et présentation de la formation au brevet de pilote. Les bénévoles sont les bienvenus pour l’accueil et la sécurité sur le parking avions.',
    tags: ['événement', 'portes ouvertes'],
  },
  {
    days: -96,
    title: 'Sécurité des vols : retour sur les remises de gaz',
    description: 'Synthèse de la soirée sécurité du mois.',
    text: 'Une remise de gaz n’est jamais un échec. La soirée sécurité a rappelé les critères d’une approche stabilisée et l’importance de décider tôt. Les supports de la présentation sont disponibles au bureau.',
    tags: ['sécurité', 'formation'],
  },
  {
    days: -61,
    event: -47,
    title: 'Sortie club au Touquet',
    description: 'Navigation en patrouille vers la côte d’Opale.',
    text: 'Quatre avions du club ont rejoint Le Touquet pour la sortie annuelle. Merci aux organisateurs et bravo aux pilotes pour la préparation des navigations.',
    tags: ['événement', 'navigation'],
  },
  {
    days: -33,
    title: 'Bienvenue aux nouveaux élèves',
    description: 'La promotion d’automne a commencé sa formation.',
    text: 'Plusieurs élèves ont commencé leur formation au brevet. Leurs leçons apparaissent dans le planning avec leur instructeur : merci de leur laisser les créneaux réservés.',
    tags: ['formation', 'club'],
  },
  {
    days: -9,
    event: 24,
    title: 'Assemblée générale du club',
    description: 'Bilan de la saison et vote du budget.',
    text: 'L’assemblée générale se tiendra au club-house. Ordre du jour : rapport moral, rapport financier, budget de l’année à venir et renouvellement du bureau. Pensez à donner votre pouvoir si vous ne pouvez pas venir.',
    tags: ['club', 'assemblée'],
  },
  {
    days: -3,
    title: 'Un avion immobilisé',
    description: 'Le Warrior est au hangar à la suite d’un incident.',
    text: 'À la suite d’un atterrissage dur, le PA-28 est immobilisé le temps de l’inspection de l’hélice et du train avant. Les réservations concernées ont été annulées et remboursées. Merci de reporter vos vols sur les autres avions.',
    tags: ['flotte', 'sécurité'],
  },
];

const doc = (heading: string, paragraph: string) => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: heading }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: paragraph }] },
  ],
});

export interface CourseContent {
  title: string;
  description: string;
  category: string;
  modules: {
    title: string;
    description: string;
    lessons: { title: string; description: string; content: object }[];
    questions: { text: string; options: string[]; correct: string }[];
  }[];
}

export const E_LEARNING: CourseContent[] = [
  {
    title: 'Fondamentaux du pilotage VFR',
    description:
      'Les bases du vol à vue, de la mécanique du vol à la navigation.',
    category: 'Formation initiale',
    modules: [
      {
        title: 'Mécanique du vol',
        description: 'Les forces qui s’exercent sur l’avion et le décrochage.',
        lessons: [
          {
            title: 'Les quatre forces',
            description: 'Portance, poids, traction et traînée.',
            content: doc(
              'Les quatre forces',
              'En vol stabilisé, la portance équilibre le poids et la traction équilibre la traînée. La portance dépend de la vitesse, de l’incidence, de la surface de l’aile et de la densité de l’air.',
            ),
          },
          {
            title: 'Le décrochage',
            description: 'Reconnaître et récupérer un décrochage.',
            content: doc(
              'Le décrochage',
              'Au-delà de l’incidence critique, l’écoulement décolle de l’extrados et la portance chute. On récupère en diminuant l’incidence, puis en remettant la puissance.',
            ),
          },
        ],
        questions: [
          {
            text: 'Quelle force équilibre le poids en vol rectiligne stabilisé ?',
            options: ['La traînée', 'La portance', 'La traction'],
            correct: 'La portance',
          },
          {
            text: 'Le décrochage survient lorsque…',
            options: [
              'la vitesse dépasse la VNE',
              'l’incidence dépasse l’incidence critique',
              'le moteur s’arrête',
            ],
            correct: 'l’incidence dépasse l’incidence critique',
          },
          {
            text: 'Première action pour sortir d’un décrochage ?',
            options: [
              'Tirer sur le manche',
              'Diminuer l’incidence',
              'Sortir les volets',
            ],
            correct: 'Diminuer l’incidence',
          },
          {
            text: 'La portance augmente avec…',
            options: ['l’altitude', 'la vitesse', 'la température'],
            correct: 'la vitesse',
          },
        ],
      },
      {
        title: 'Navigation à vue',
        description: 'Préparer et conduire une navigation.',
        lessons: [
          {
            title: 'Préparer une navigation',
            description: 'Route, log, carburant, météo.',
            content: doc(
              'Préparer une navigation',
              'Tracer la route sur la carte au 1/500 000, calculer caps et temps, consulter les NOTAM et la météo, établir le devis de carburant avec la réserve réglementaire et le devis de masse et centrage.',
            ),
          },
          {
            title: 'La carte aéronautique',
            description: 'Lire les espaces aériens et les zones.',
            content: doc(
              'La carte aéronautique',
              'La carte OACI représente les espaces aériens, les zones réglementées, dangereuses et interdites, les aérodromes, les obstacles et le relief.',
            ),
          },
        ],
        questions: [
          {
            text: 'Quelle échelle pour la carte VFR de navigation courante ?',
            options: ['1/50 000', '1/500 000', '1/1 000 000'],
            correct: '1/500 000',
          },
          {
            text: 'Une zone notée « R » est une zone…',
            options: ['réglementée', 'de repos', 'radar'],
            correct: 'réglementée',
          },
          {
            text: 'Le devis de carburant inclut…',
            options: [
              'uniquement le trajet',
              'le trajet et la réserve finale',
              'la réserve seule',
            ],
            correct: 'le trajet et la réserve finale',
          },
        ],
      },
    ],
  },
  {
    title: 'Météorologie pour le pilote',
    description: 'Lire la météo pour décider avant le vol.',
    category: 'Théorie',
    modules: [
      {
        title: 'Messages d’observation et de prévision',
        description: 'METAR, TAF et cartes TEMSI.',
        lessons: [
          {
            title: 'Décoder un METAR',
            description: 'Vent, visibilité, nuages, température, QNH.',
            content: doc(
              'Décoder un METAR',
              'Exemple : LFOX 161230Z 24012KT 9999 FEW035 16/08 Q1018. Le vent vient du 240° à 12 kt, la visibilité dépasse 10 km, quelques nuages à 3500 ft, QNH 1018 hPa.',
            ),
          },
          {
            title: 'Les fronts',
            description: 'Front chaud, front froid et leurs nuages.',
            content: doc(
              'Les fronts',
              'Le front chaud apporte des nuages stratiformes et des pluies continues ; le front froid des cumulonimbus, des averses et des rafales.',
            ),
          },
        ],
        questions: [
          {
            text: 'Dans « 24012KT », 12 représente…',
            options: [
              'la direction',
              'la vitesse du vent en nœuds',
              'la visibilité',
            ],
            correct: 'la vitesse du vent en nœuds',
          },
          {
            text: 'Q1018 indique…',
            options: ['le QNH', 'la température', 'la hauteur des nuages'],
            correct: 'le QNH',
          },
          {
            text: 'Un front froid s’accompagne souvent…',
            options: [
              'de brouillard',
              'd’averses et de rafales',
              'd’un ciel clair',
            ],
            correct: 'd’averses et de rafales',
          },
        ],
      },
    ],
  },
];

export const CHECKLIST_ITEMS: [ChecklistCategory, string, string, boolean][] = [
  [
    ChecklistCategory.DOCUMENTS,
    'Documents de bord',
    'Certificat de navigabilité, immatriculation, assurance, carnet de route.',
    true,
  ],
  [
    ChecklistCategory.DOCUMENTS,
    'Carnet de route',
    'Heures et potentiels à jour, remarques du vol précédent.',
    true,
  ],
  [
    ChecklistCategory.EXTERIOR,
    'Cellule et revêtement',
    'Aucune déformation, aucun impact.',
    true,
  ],
  [
    ChecklistCategory.EXTERIOR,
    'Gouvernes et volets',
    'Débattement libre, fixations.',
    true,
  ],
  [
    ChecklistCategory.EXTERIOR,
    'Train et pneus',
    'Usure, gonflage, carénages.',
    true,
  ],
  [ChecklistCategory.EXTERIOR, 'Hélice', 'Pas d’éclat ni de crique.', true],
  [
    ChecklistCategory.EXTERIOR,
    'Prise pitot et statique',
    'Non obstruées, protection retirée.',
    true,
  ],
  [
    ChecklistCategory.ENGINE,
    'Niveau d’huile',
    'Dans la plage indiquée par le manuel.',
    true,
  ],
  [
    ChecklistCategory.ENGINE,
    'Carburant : quantité',
    'Contrôle visuel des réservoirs.',
    true,
  ],
  [
    ChecklistCategory.ENGINE,
    'Carburant : purges',
    'Pas d’eau ni d’impureté.',
    true,
  ],
  [
    ChecklistCategory.COCKPIT,
    'Commandes de vol',
    'Libres et dans le bon sens.',
    true,
  ],
  [
    ChecklistCategory.COCKPIT,
    'Instruments et radio',
    'Calage altimètre, essais radio et transpondeur.',
    true,
  ],
  [
    ChecklistCategory.COCKPIT,
    'Ceintures et verrière',
    'Ceintures attachées, verrière verrouillée.',
    true,
  ],
  [
    ChecklistCategory.EMERGENCY,
    'Extincteur et trousse de secours',
    'Présents et en date.',
    true,
  ],
  [
    ChecklistCategory.EMERGENCY,
    'Gilets de sauvetage',
    'Pour un vol au-dessus de l’eau.',
    false,
  ],
];

export const AUDIT_TEMPLATE = {
  name: 'Audit sécurité annuel — avion club',
  description:
    'Contrôle annuel de l’état et de la documentation de chaque avion du club.',
  items: [
    [
      AuditCategoryType.DOCUMENTATION,
      'Documents de bord',
      'Présence et validité des documents.',
      CriticalityLevel.MAJEUR,
    ],
    [
      AuditCategoryType.CELLULE,
      'État de la cellule',
      'Corrosion, déformations, impacts.',
      CriticalityLevel.MAJEUR,
    ],
    [
      AuditCategoryType.MOTEUR,
      'Compartiment moteur',
      'Fuites, fixations, échappement.',
      CriticalityLevel.CRITIQUE,
    ],
    [
      AuditCategoryType.TRAIN_ATTERRISSAGE,
      'Train d’atterrissage',
      'Amortisseurs, freins, pneus.',
      CriticalityLevel.MAJEUR,
    ],
    [
      AuditCategoryType.SYSTEME_CARBURANT,
      'Circuit carburant',
      'Purges, durites, jauges.',
      CriticalityLevel.CRITIQUE,
    ],
    [
      AuditCategoryType.SYSTEME_ELECTRIQUE,
      'Circuit électrique',
      'Batterie, alternateur, éclairage.',
      CriticalityLevel.MINEUR,
    ],
    [
      AuditCategoryType.AVIONIQUE,
      'Radio et transpondeur',
      'Essais et bases de données.',
      CriticalityLevel.MINEUR,
    ],
    [
      AuditCategoryType.EQUIPEMENT_SECURITE,
      'Équipements de sécurité',
      'Extincteur, ELT, trousse.',
      CriticalityLevel.MAJEUR,
    ],
  ] as [AuditCategoryType, string, string, CriticalityLevel][],
};

export const AUDIT_REMARKS = [
  'Usure du pneu droit à surveiller.',
  'Date de l’extincteur à renouveler dans les trois mois.',
  'Légère trace d’huile sur le carter, à surveiller à la prochaine visite.',
  'Étiquette de la balise ELT peu lisible.',
];
