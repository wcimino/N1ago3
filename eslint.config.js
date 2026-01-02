import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['*/index', '*/index.js', '*/index.ts'],
            message: 'Avoid barrel imports. Import directly from the source file (e.g., "./storage/conversationStorage.js" instead of "./storage/index.js").',
          },
        ],
      }],
    },
  },
];
