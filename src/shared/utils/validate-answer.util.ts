export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
): boolean {
  return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}
