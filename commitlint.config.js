// Accepts Conventional Commits (`feat(auth): …`) or ticket-prefixed headers (`EPIC-1: …`, `CDZ-42: …`).
const TICKET_HEADER = /^[A-Z][A-Z0-9]+-\d+: \S.{0,99}$/;

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => TICKET_HEADER.test(message.split('\n')[0] ?? '')],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'auth',
        'booking',
        'catalog',
        'health',
        'grpc',
        'http',
        'infra',
        'config',
        'db',
        'deps',
        'ci',
        'docs',
        'agents',
      ],
    ],
  },
};
