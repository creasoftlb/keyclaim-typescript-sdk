module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // Add custom rules here
    '@typescript-eslint/no-explicit-any': 'warn', // Warn for 'any' in source files
    'no-case-declarations': 'off', // Allow lexical declarations in case blocks
  },
  overrides: [
    {
      files: ['__tests__/**/*.ts'], // Apply to test files
      parserOptions: {
        project: ['./tsconfig.test.json'], // Use specific tsconfig for tests
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test files
      },
    },
  ],
};

