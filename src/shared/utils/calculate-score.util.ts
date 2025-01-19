export function calculateScore(
  correctAnswers: number,
  totalQuestions: number,
): number {
  if (totalQuestions === 0) return 0;
  return Math.round((correctAnswers / totalQuestions) * 100);
}
