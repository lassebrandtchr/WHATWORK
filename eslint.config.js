import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Lint-opsætning. Den typebevidste konfiguration bruges, fordi motorens regler
 * afhænger af typerne — en fejl i en union skal fanges her og ikke i salen.
 */
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'coverage', 'design'] },

  js.configs.recommended,
  // Typebevidst linting gælder kun TypeScript-filerne. Konfigurationen og de få
  // JavaScript-filer har ingen tsconfig og ville ellers vælte hele kørslen.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',

      // Motorens data er skrevet som literaler; ikke-null-assertions bruges ikke.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Slået fra: reglen ser ikke noUncheckedIndexedAccess på tværs af de to
      // tsconfig-projekter og vil fjerne assertions, som tsc faktisk kræver.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],

      // Fejl, der ville ende som en tavs forkert workout, skal fanges her.
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',

      // Praktiske undtagelser for et projekt uden backend-typer.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  {
    // JavaScript-filerne (serverless-shim, ikonscript, denne konfiguration) har
    // ingen tsconfig og kan derfor ikke type-lintes.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
