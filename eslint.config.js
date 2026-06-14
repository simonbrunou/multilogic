import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally-unused args/vars prefixed with `_` (e.g. overridable base-class hooks).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': ['error',
        { name: 'self', message: 'engine must be runtime-agnostic' },
        { name: 'window', message: 'engine must be runtime-agnostic' },
        { name: 'document', message: 'engine must be runtime-agnostic' },
        { name: 'crypto', message: 'use the injected PRNG' },
        { name: 'performance', message: 'engine must be runtime-agnostic' }
      ],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'use the injected PRNG' }
      ]
    }
  },
  {
    files: ['serve.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } }
  },
  { ignores: ['.svelte-kit/', 'build/', 'node_modules/'] }
);
