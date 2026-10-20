// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const INFRA_LIBS = [
  'fastify',
  '@fastify/*',
  'pg',
  'ioredis',
  'jose',
  'bcryptjs',
  'prom-client',
  'js-yaml',
  'pino',
];

/**
 * Hexagonal boundary rules — dependencies point inward only:
 *   bootstrap -> adapters (primary | secondary | repositories) -> ports <- services -> domain
 * Domain, ports and services must never import infrastructure libraries.
 */
const boundary = (/** @type {string[]} */ forbiddenLayers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        ...forbiddenLayers.map((layer) => ({
          group: [`**/${layer}/**`, `**/${layer}`],
          message: `Hexagonal boundary violation: this layer must not depend on "${layer}".`,
        })),
        { group: INFRA_LIBS, message: 'Infrastructure libraries belong in src/adapters only.' },
      ],
    },
  ],
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: boundary(['ports', 'services', 'adapters', 'bootstrap', 'config']),
  },
  { files: ['src/ports/**/*.ts'], rules: boundary(['services', 'adapters', 'bootstrap', 'config']) },
  { files: ['src/services/**/*.ts'], rules: boundary(['adapters', 'bootstrap', 'config']) },
  { files: ['test/**/*.ts', 'scripts/**'], rules: { 'no-console': 'off' } },
);
