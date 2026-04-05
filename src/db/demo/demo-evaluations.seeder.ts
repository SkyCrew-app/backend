import { DataSource } from 'typeorm';
import { Evaluation } from '../../modules/eval/entity/evaluation.entity';
import { Question } from '../../modules/eval/entity/question.entity';
import { Answer } from '../../modules/eval/entity/answer.entity';
import { UserProgress } from '../../modules/users/entity/user-progress.entity';
import { Module } from '../../modules/e-learning/entity/module.entity';
import { Lesson } from '../../modules/e-learning/entity/lesson.entity';
import { User } from '../../modules/users/entity/users.entity';

export const seedDemoEvaluations = async (
  dataSource: DataSource,
  users: User[],
): Promise<void> => {
  const evalRepo = dataSource.getRepository(Evaluation);
  const questionRepo = dataSource.getRepository(Question);
  const answerRepo = dataSource.getRepository(Answer);
  const progressRepo = dataSource.getRepository(UserProgress);
  const moduleRepo = dataSource.getRepository(Module);
  const lessonRepo = dataSource.getRepository(Lesson);

  // Fetch existing modules from e-learning seeder
  const modules = await moduleRepo.find({ relations: ['course'] });
  const lessons = await lessonRepo.find({ relations: ['module'] });

  if (modules.length === 0) {
    console.log('No modules found - skip evaluations seeder');
    return;
  }

  const admin = users[0];
  const pilotes = [users[1], users[4], users[5], users[8], users[9]]; // Jean, Sophie, Lucas, Emma, Antoine

  // ============================================
  // Evaluation 1: Mécanique du vol
  // ============================================
  const mecaModule = modules.find(m => m.title === 'Mécanique du vol');
  if (mecaModule) {
    const eval1 = evalRepo.create({ module: mecaModule, pass_score: 70 });
    const savedEval1 = await evalRepo.save(eval1);

    const questions1 = [
      {
        content: { text: 'Quelles sont les 4 forces fondamentales qui s\'exercent sur un avion en vol ?' },
        options: ['Portance, Traînée, Poids, Traction', 'Portance, Gravité, Poussée, Friction', 'Lift, Drag, Thrust, Weight', 'Sustentation, Résistance, Masse, Propulsion'],
        correct_answer: 'Portance, Traînée, Poids, Traction',
      },
      {
        content: { text: 'À quel angle d\'incidence se produit généralement le décrochage ?' },
        options: ['5-8°', '10-12°', '15-18°', '20-25°'],
        correct_answer: '15-18°',
      },
      {
        content: { text: 'Quel est le premier signe de décrochage ?' },
        options: ['Chute de l\'altimètre', 'Buffeting (vibrations)', 'Alarme moteur', 'Perte de vitesse sur l\'anémomètre'],
        correct_answer: 'Buffeting (vibrations)',
      },
      {
        content: { text: 'Comment récupérer d\'un décrochage ?' },
        options: ['Augmenter l\'inclinaison', 'Diminuer l\'incidence et augmenter la puissance', 'Tirer sur le manche', 'Couper le moteur'],
        correct_answer: 'Diminuer l\'incidence et augmenter la puissance',
      },
      {
        content: { text: 'De quoi dépend principalement la portance ?' },
        options: ['Uniquement de la vitesse', 'De la vitesse, l\'angle d\'incidence, la surface alaire et la densité de l\'air', 'Uniquement du profil de l\'aile', 'De la puissance moteur'],
        correct_answer: 'De la vitesse, l\'angle d\'incidence, la surface alaire et la densité de l\'air',
      },
    ];

    const savedQuestions1 = [];
    for (const qData of questions1) {
      const q = questionRepo.create({ ...qData, evaluation: savedEval1 });
      savedQuestions1.push(await questionRepo.save(q));
    }

    // Réponses d'Emma (score: 80% - 4/5)
    for (let i = 0; i < savedQuestions1.length; i++) {
      const isCorrect = i !== 2; // Se trompe sur la question 3
      const answer = answerRepo.create({
        question: savedQuestions1[i],
        user: pilotes[3], // Emma
        answer_text: isCorrect ? savedQuestions1[i].correct_answer : savedQuestions1[i].options[0],
        is_correct: isCorrect,
      });
      await answerRepo.save(answer);
    }

    // User progress Emma - eval completed
    const progress1 = progressRepo.create({
      user: pilotes[3],
      evaluation: savedEval1,
      completed: true,
      score: 80,
      passed: true,
      completed_at: new Date(Date.now() - 10 * 24 * 3600000),
    });
    await progressRepo.save(progress1);

    // Réponses de l'admin (score: 100% - 5/5)
    for (const q of savedQuestions1) {
      const answer = answerRepo.create({
        question: q,
        user: admin,
        answer_text: q.correct_answer,
        is_correct: true,
      });
      await answerRepo.save(answer);
    }

    const progressAdmin1 = progressRepo.create({
      user: admin,
      evaluation: savedEval1,
      completed: true,
      score: 100,
      passed: true,
      completed_at: new Date(Date.now() - 15 * 24 * 3600000),
    });
    await progressRepo.save(progressAdmin1);

    // Réponses de Sophie (score: 60% - 3/5)
    for (let i = 0; i < savedQuestions1.length; i++) {
      const isCorrect = i < 3; // Se trompe sur questions 4 et 5
      const answer = answerRepo.create({
        question: savedQuestions1[i],
        user: pilotes[1], // Sophie
        answer_text: isCorrect ? savedQuestions1[i].correct_answer : savedQuestions1[i].options[1],
        is_correct: isCorrect,
      });
      await answerRepo.save(answer);
    }

    const progress1b = progressRepo.create({
      user: pilotes[1],
      evaluation: savedEval1,
      completed: true,
      score: 60,
      passed: false,
      completed_at: new Date(Date.now() - 8 * 24 * 3600000),
    });
    await progressRepo.save(progress1b);
  }

  // ============================================
  // Evaluation 2: Navigation à vue
  // ============================================
  const navModule = modules.find(m => m.title === 'Navigation à vue');
  if (navModule) {
    const eval2 = evalRepo.create({ module: navModule, pass_score: 75 });
    const savedEval2 = await evalRepo.save(eval2);

    const questions2 = [
      {
        content: { text: 'Quelle est l\'échelle de la carte OACI utilisée en VFR ?' },
        options: ['1/250 000', '1/500 000', '1/1 000 000', '1/100 000'],
        correct_answer: '1/500 000',
      },
      {
        content: { text: 'Que représente une zone "R" sur la carte OACI ?' },
        options: ['Zone réservée', 'Zone réglementée', 'Zone restreinte', 'Zone de ravitaillement'],
        correct_answer: 'Zone réglementée',
      },
      {
        content: { text: 'Quels documents faut-il consulter avant un vol de navigation VFR ?' },
        options: ['METAR uniquement', 'METAR et TAF', 'METAR, TAF, TEMSI, WINTEM et NOTAMs', 'Carte IGN et bulletin météo TV'],
        correct_answer: 'METAR, TAF, TEMSI, WINTEM et NOTAMs',
      },
      {
        content: { text: 'Quelle est la réserve carburant réglementaire pour un vol VFR de jour ?' },
        options: ['15 minutes', '20 minutes', '30 minutes', '45 minutes'],
        correct_answer: '30 minutes',
      },
    ];

    const savedQuestions2 = [];
    for (const qData of questions2) {
      const q = questionRepo.create({ ...qData, evaluation: savedEval2 });
      savedQuestions2.push(await questionRepo.save(q));
    }

    // Réponses de Jean (score: 100% - 4/4)
    for (const q of savedQuestions2) {
      const answer = answerRepo.create({
        question: q,
        user: pilotes[0], // Jean
        answer_text: q.correct_answer,
        is_correct: true,
      });
      await answerRepo.save(answer);
    }

    // Admin - 100% nav (4/4)
    for (const q of savedQuestions2) {
      const answer = answerRepo.create({
        question: q,
        user: admin,
        answer_text: q.correct_answer,
        is_correct: true,
      });
      await answerRepo.save(answer);
    }

    const progressAdmin2 = progressRepo.create({
      user: admin,
      evaluation: savedEval2,
      completed: true,
      score: 100,
      passed: true,
      completed_at: new Date(Date.now() - 18 * 24 * 3600000),
    });
    await progressRepo.save(progressAdmin2);

    const progress2 = progressRepo.create({
      user: pilotes[0],
      evaluation: savedEval2,
      completed: true,
      score: 100,
      passed: true,
      completed_at: new Date(Date.now() - 20 * 24 * 3600000),
    });
    await progressRepo.save(progress2);
  }

  // ============================================
  // Evaluation 3: Météo
  // ============================================
  const meteoModule = modules.find(m => m.title === 'L\'atmosphère');
  if (meteoModule) {
    const eval3 = evalRepo.create({ module: meteoModule, pass_score: 70 });
    const savedEval3 = await evalRepo.save(eval3);

    const questions3 = [
      {
        content: { text: 'Que signifie "CAVOK" dans un METAR ?' },
        options: ['Visibilité > 10km, pas de nuage significatif sous 5000ft, pas de CB', 'Conditions acceptables pour le vol', 'Ciel clair sans vent', 'Visibilité > 5km sans pluie'],
        correct_answer: 'Visibilité > 10km, pas de nuage significatif sous 5000ft, pas de CB',
      },
      {
        content: { text: 'Quelle est la durée de validité d\'un METAR ?' },
        options: ['15 minutes', '30 minutes', '1 heure', '3 heures'],
        correct_answer: '30 minutes',
      },
      {
        content: { text: 'Un front froid apporte généralement :' },
        options: ['Des nuages stratiformes et une pluie continue', 'Des cumulonimbus et des averses', 'Un ciel dégagé', 'Du brouillard'],
        correct_answer: 'Des cumulonimbus et des averses',
      },
      {
        content: { text: 'Que signifie "SCT025" dans un METAR ?' },
        options: ['Nuages épars à 2500ft', 'Nuages épars à 25000ft', 'Nuages compacts à 2500ft', 'Visibilité réduite à 25km'],
        correct_answer: 'Nuages épars à 2500ft',
      },
    ];

    const savedQuestions3 = [];
    for (const qData of questions3) {
      const q = questionRepo.create({ ...qData, evaluation: savedEval3 });
      savedQuestions3.push(await questionRepo.save(q));
    }

    // Admin - 75% (3/4)
    for (let i = 0; i < savedQuestions3.length; i++) {
      const isCorrect = i !== 3;
      const answer = answerRepo.create({
        question: savedQuestions3[i],
        user: admin,
        answer_text: isCorrect ? savedQuestions3[i].correct_answer : savedQuestions3[i].options[0],
        is_correct: isCorrect,
      });
      await answerRepo.save(answer);
    }

    const progressAdmin3 = progressRepo.create({
      user: admin,
      evaluation: savedEval3,
      completed: true,
      score: 75,
      passed: true,
      completed_at: new Date(Date.now() - 3 * 24 * 3600000),
    });
    await progressRepo.save(progressAdmin3);

    // Antoine - 75% (3/4)
    for (let i = 0; i < savedQuestions3.length; i++) {
      const isCorrect = i !== 1;
      const answer = answerRepo.create({
        question: savedQuestions3[i],
        user: pilotes[4],
        answer_text: isCorrect ? savedQuestions3[i].correct_answer : savedQuestions3[i].options[2],
        is_correct: isCorrect,
      });
      await answerRepo.save(answer);
    }

    const progress3 = progressRepo.create({
      user: pilotes[4],
      evaluation: savedEval3,
      completed: true,
      score: 75,
      passed: true,
      completed_at: new Date(Date.now() - 5 * 24 * 3600000),
    });
    await progressRepo.save(progress3);
  }

  // ============================================
  // User Progress for lessons
  // ============================================
  const mecaLessons = lessons.filter(l => l.module?.title === 'Mécanique du vol');
  const navLessons = lessons.filter(l => l.module?.title === 'Navigation à vue');
  const radioLessons = lessons.filter(l => l.module?.title === 'Procédures radio');
  const meteoLessons = lessons.filter(l => l.module?.title === 'L\'atmosphère');

  // Admin - completed all lessons
  for (const lesson of [...mecaLessons, ...navLessons, ...radioLessons, ...meteoLessons]) {
    const p = progressRepo.create({
      user: admin,
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 20 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Emma - completed meca lessons
  for (const lesson of mecaLessons) {
    const p = progressRepo.create({
      user: pilotes[3],
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 12 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Emma - completed first nav lesson only
  if (navLessons.length > 0) {
    const p = progressRepo.create({
      user: pilotes[3],
      lesson: navLessons[0],
      completed: true,
      completed_at: new Date(Date.now() - 5 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Jean - completed all nav + radio lessons
  for (const lesson of [...navLessons, ...radioLessons]) {
    const p = progressRepo.create({
      user: pilotes[0],
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 22 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Antoine - completed meteo lessons
  for (const lesson of meteoLessons) {
    const p = progressRepo.create({
      user: pilotes[4],
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 7 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Sophie - completed meca lessons (but failed eval)
  for (const lesson of mecaLessons) {
    const p = progressRepo.create({
      user: pilotes[1],
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 9 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  // Lucas - completed everything
  for (const lesson of [...mecaLessons, ...navLessons, ...radioLessons, ...meteoLessons]) {
    const p = progressRepo.create({
      user: pilotes[2],
      lesson: lesson,
      completed: true,
      completed_at: new Date(Date.now() - 30 * 24 * 3600000),
    });
    await progressRepo.save(p);
  }

  console.log('Demo evaluations, questions, answers and user progress created');
};
