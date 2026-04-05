import { DataSource } from 'typeorm';
import { Course } from '../../modules/e-learning/entity/course.entity';
import { Module } from '../../modules/e-learning/entity/module.entity';
import { Lesson } from '../../modules/e-learning/entity/lesson.entity';
import { LicenseType } from '../../shared/enums/licence-type.enum';

export const seedDemoELearning = async (
  dataSource: DataSource,
): Promise<void> => {
  const courseRepository = dataSource.getRepository(Course);
  const moduleRepository = dataSource.getRepository(Module);
  const lessonRepository = dataSource.getRepository(Lesson);

  const courses = [
    {
      title: 'Fondamentaux du pilotage VFR',
      description: 'Cours complet couvrant les bases du vol à vue, de la mécanique du vol aux procédures radio.',
      category: 'Formation initiale',
      required_license: LicenseType.PPL,
      modules: [
        {
          title: 'Mécanique du vol',
          description: 'Comprendre les forces aérodynamiques et le comportement de l\'avion.',
          lessons: [
            {
              title: 'Les 4 forces du vol',
              description: 'Portance, traînée, poids et traction.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Les 4 forces fondamentales' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'En vol stabilisé, un avion est soumis à quatre forces principales qui s\'équilibrent : la portance (vers le haut), le poids (vers le bas), la traction (vers l\'avant) et la traînée (vers l\'arrière).' }] },
                  { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'La portance' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'La portance est générée par le profil de l\'aile. L\'air circulant plus vite sur l\'extrados que sur l\'intrados crée une dépression au-dessus de l\'aile. Elle dépend de la vitesse, de l\'angle d\'incidence, de la surface alaire et de la densité de l\'air.' }] },
                ],
              },
            },
            {
              title: 'Le décrochage',
              description: 'Comprendre et reconnaître le décrochage aérodynamique.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Le décrochage' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Le décrochage survient lorsque l\'angle d\'incidence dépasse l\'angle critique (environ 15-18° selon le profil). La couche limite se décolle de l\'extrados et la portance chute brutalement.' }] },
                  { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Signes précurseurs' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Buffeting (vibrations), avertisseur de décrochage, commandes molles, vitesse faible. La récupération consiste à diminuer l\'incidence (manche en avant) et augmenter la puissance.' }] },
                ],
              },
            },
          ],
        },
        {
          title: 'Navigation à vue',
          description: 'Techniques de navigation VFR : carte, repères visuels, estime et radionavigation.',
          lessons: [
            {
              title: 'Préparation d\'une navigation',
              description: 'Étapes de planification d\'un vol VFR cross-country.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Planifier sa navigation' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'La préparation d\'un vol de navigation comprend : le tracé de la route sur carte OACI 1/500 000, le calcul des caps et temps de vol, la vérification des NOTAMs, l\'analyse météo (METAR, TAF, TEMSI, WINTEM), et le calcul carburant avec les réserves réglementaires.' }] },
                ],
              },
            },
            {
              title: 'Lecture de carte OACI',
              description: 'Symbologie et utilisation de la carte aéronautique.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'La carte OACI 1/500 000' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'La carte OACI est l\'outil principal du pilote VFR. Elle représente les espaces aériens (classes A à G), les aérodromes, les obstacles, les zones réglementées (R), dangereuses (D) et interdites (P), ainsi que le relief par courbes de niveau et teintes hypsométriques.' }] },
                ],
              },
            },
          ],
        },
        {
          title: 'Procédures radio',
          description: 'Communication avec les services ATC en VFR.',
          lessons: [
            {
              title: 'Phraséologie standard',
              description: 'Les messages radio essentiels pour un vol VFR.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Phraséologie VFR' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'La communication radio suit un format standardisé : QUI j\'appelle, QUI je suis, OÙ je suis, CE QUE je veux. Exemple : "Bordeaux Tour, F-GSKY, verticale nord 2000ft, pour intégration piste 23."' }] },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      title: 'Météorologie aéronautique',
      description: 'Comprendre la météo pour prendre de meilleures décisions en vol.',
      category: 'Théorie',
      required_license: LicenseType.PPL,
      modules: [
        {
          title: 'L\'atmosphère',
          description: 'Structure de l\'atmosphère et phénomènes météorologiques.',
          lessons: [
            {
              title: 'Les masses d\'air et les fronts',
              description: 'Comprendre la dynamique des masses d\'air.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Masses d\'air et fronts' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Une masse d\'air est un volume d\'air homogène en température et humidité. Lorsque deux masses d\'air de caractéristiques différentes se rencontrent, elles forment un front. Le front chaud apporte des nuages stratiformes et une pluie continue, le front froid des cumulonimbus et des averses.' }] },
                ],
              },
            },
            {
              title: 'Décoder un METAR et un TAF',
              description: 'Lire et interpréter les messages météo aéronautiques.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'METAR & TAF' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Le METAR est un message d\'observation météo émis toutes les 30 minutes. Exemple : LFPO 211230Z 24008KT 9999 FEW040 18/09 Q1018. Le TAF est une prévision valable 9 à 30 heures. Ces deux documents sont indispensables pour la préparation du vol.' }] },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      title: 'Réglementation aérienne',
      description: 'Règles de l\'air, espaces aériens et réglementation DGAC/EASA.',
      category: 'Réglementation',
      required_license: LicenseType.PPL,
      modules: [
        {
          title: 'Les espaces aériens',
          description: 'Classification et règles associées aux espaces aériens.',
          lessons: [
            {
              title: 'Classes d\'espaces aériens',
              description: 'De la classe A à la classe G : règles et services.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Classification des espaces' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Les espaces aériens sont classés de A (le plus restrictif) à G (non contrôlé). En France, le VFR est interdit en classe A. Les classes B, C et D nécessitent une clairance ATC. La classe E nécessite un contact radio. Les classes F et G sont non contrôlées mais des services d\'information de vol sont disponibles.' }] },
                ],
              },
            },
          ],
        },
        {
          title: 'Règles de vol à vue (VFR)',
          description: 'Conditions et minima pour le vol VFR.',
          lessons: [
            {
              title: 'Conditions VMC',
              description: 'Minima de visibilité et de distance aux nuages en VFR.',
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conditions VMC' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Pour voler en VFR, le pilote doit maintenir les conditions météorologiques de vol à vue (VMC). En espace non contrôlé sous le FL100 : visibilité ≥ 5km (ou 1500m hors nuages en vue du sol sous 3000ft AMSL), distance aux nuages 1500m horizontalement et 300m (1000ft) verticalement.' }] },
                ],
              },
            },
          ],
        },
      ],
    },
  ];

  for (const courseData of courses) {
    const { modules: modulesData, ...courseFields } = courseData;
    const course = courseRepository.create(courseFields);
    const savedCourse = await courseRepository.save(course);

    for (const moduleData of modulesData) {
      const { lessons: lessonsData, ...moduleFields } = moduleData;
      const module = moduleRepository.create({
        ...moduleFields,
        course: savedCourse,
      });
      const savedModule = await moduleRepository.save(module);

      for (const lessonData of lessonsData) {
        const lesson = lessonRepository.create({
          ...lessonData,
          module: savedModule,
          attachments: [],
        });
        await lessonRepository.save(lesson);
      }
    }

    console.log(`Demo course "${courseData.title}" created with modules and lessons`);
  }

  console.log('Demo e-learning seeding completed');
};
