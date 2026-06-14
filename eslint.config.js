import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/engine/**/*.ts'],
    rules: {
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
  { ignores: ['.svelte-kit/', 'build/', 'node_modules/'] }
);
