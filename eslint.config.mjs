// ESLint flat config (v9+)
// Chrome 拡張機能向け軽量設定: ブラウザ + Service Worker + chrome.* API

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
  {
    files: ['scripts/**/*.js', 'generate-icons.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Cloudflare Worker (ESM, fetch/Response/Headers などのグローバル)
    files: ['cloudflare-worker/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.worker,
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'icons/', '*.zip', 'pnpm-lock.yaml'],
  },
];
