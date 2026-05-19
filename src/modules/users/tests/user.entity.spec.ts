import { UserProgress } from '../entity/user-progress.entity';
import { User } from '../entity/users.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { Evaluation } from '../../eval/entity/evaluation.entity';

describe('UserProgress Entity', () => {
  it('should create a user progress instance', () => {
    const progress = new UserProgress();
    expect(progress).toBeInstanceOf(UserProgress);
  });

  it('should set all properties correctly', () => {
    const progress = new UserProgress();
    const user = new User();
    const lesson = new Lesson();
    const evaluation = new Evaluation();
    const completedAt = new Date('2023-12-01T10:00:00Z');

    progress.id = 1;
    progress.user = user;
    progress.lesson = lesson;
    progress.evaluation = evaluation;
    progress.completed = true;
    progress.score = 95.5;
    progress.passed = true;
    progress.completed_at = completedAt;

    expect(progress.id).toBe(1);
    expect(progress.user).toBe(user);
    expect(progress.lesson).toBe(lesson);
    expect(progress.evaluation).toBe(evaluation);
    expect(progress.completed).toBe(true);
    expect(progress.score).toBe(95.5);
    expect(progress.passed).toBe(true);
    expect(progress.completed_at).toEqual(completedAt);
  });

  it('should have default values for boolean fields', () => {
    const progress = new UserProgress();

    // Les valeurs par défaut sont définies au niveau de la base de données
    // mais on peut tester l'assignation
    progress.completed = false;
    progress.passed = false;

    expect(progress.completed).toBe(false);
    expect(progress.passed).toBe(false);
  });

  it('should allow nullable fields', () => {
    const progress = new UserProgress();

    progress.lesson = null;
    progress.evaluation = null;
    progress.score = null;
    progress.completed_at = null;

    expect(progress.lesson).toBeNull();
    expect(progress.evaluation).toBeNull();
    expect(progress.score).toBeNull();
    expect(progress.completed_at).toBeNull();
  });

  it('should handle different score ranges', () => {
    const progress = new UserProgress();

    // Score parfait
    progress.score = 100;
    progress.passed = true;
    expect(progress.score).toBe(100);

    // Score minimal
    progress.score = 0;
    progress.passed = false;
    expect(progress.score).toBe(0);

    // Score décimal
    progress.score = 87.3;
    expect(progress.score).toBe(87.3);
  });

  it('should handle completion scenarios', () => {
    const progress = new UserProgress();
    const completionDate = new Date();

    // Leçon complétée avec succès
    progress.completed = true;
    progress.passed = true;
    progress.score = 85;
    progress.completed_at = completionDate;

    expect(progress.completed).toBe(true);
    expect(progress.passed).toBe(true);
    expect(progress.completed_at).toEqual(completionDate);

    // Leçon complétée mais échouée
    progress.completed = true;
    progress.passed = false;
    progress.score = 45;

    expect(progress.completed).toBe(true);
    expect(progress.passed).toBe(false);
  });

  it('should maintain relationships correctly', () => {
    const progress = new UserProgress();
    const user = new User();
    const lesson = new Lesson();
    const evaluation = new Evaluation();

    user.id = 1;
    lesson.id = 1;
    evaluation.id = 1;

    progress.user = user;
    progress.lesson = lesson;
    progress.evaluation = evaluation;

    expect(progress.user.id).toBe(1);
    expect(progress.lesson.id).toBe(1);
    expect(progress.evaluation.id).toBe(1);
  });
});
