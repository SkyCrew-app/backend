// Commit format: <type>(<scope>)?: :gitmoji: <subject>
// Example: feat(auth): :sparkles: add two-factor login
const HEADER_PATTERN =
  /^(\w+)(?:\(([^)]+)\))?!?: (:[a-z0-9_+-]+:) (.+)$/;

const AI_ATTRIBUTION_PATTERN =
  /\b(claude|anthropic|chatgpt|openai|copilot)\b|generated with|co-authored-by:.*\b(ai|bot)\b/i;

module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: HEADER_PATTERN,
      headerCorrespondence: ['type', 'scope', 'gitmoji', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'gitmoji-required': ({ gitmoji }) => [
          Boolean(gitmoji),
          'header must match "<type>(<scope>)?: :gitmoji: <subject>"',
        ],
        'no-ai-attribution': ({ raw }) => [
          !AI_ATTRIBUTION_PATTERN.test(raw || ''),
          'commit message must not mention an AI assistant or carry AI attribution',
        ],
      },
    },
  ],
  rules: {
    'gitmoji-required': [2, 'always'],
    'no-ai-attribution': [2, 'always'],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
  },
};
