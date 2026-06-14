import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
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
  }
];
