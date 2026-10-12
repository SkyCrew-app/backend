// Commit format: <type>(<scope>)?: :gitmoji: <subject>
// Example: feat(auth): :sparkles: add two-factor login
const HEADER_PATTERN =
  /^(\w+)(?:\(([^)]+)\))?!?: (:[a-z0-9_+-]+:) (.+)$/;

// A squash merge appends the pull request number to the title: " (#123)".
// The limit applies to what was written, not to that reference.
const HEADER_MAX_LENGTH = 100;
const PULL_REQUEST_REFERENCE = / \(#\d+\)$/;

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
        'header-max-length-without-reference': ({ header }) => {
          const written = (header || '').replace(PULL_REQUEST_REFERENCE, '');
          return [
            written.length <= HEADER_MAX_LENGTH,
            `header must not be longer than ${HEADER_MAX_LENGTH} characters, current length is ${written.length}`,
          ];
        },
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
    'header-max-length-without-reference': [2, 'always'],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
  },
};
