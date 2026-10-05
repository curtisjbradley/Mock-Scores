/** @type {import('ts-jest').JestConfigWithTsJest} */
const tsJestPath = require.resolve('ts-jest');

module.exports = {
  testEnvironment: 'node',

  roots: ['<rootDir>/src'],

  testMatch: [
    '**/__tests__/**/*.test.ts',
  ],

  moduleNameMapper: {
    // Resolve the shared workspace from source during tests.
    '^@mock-scores/shared$': '<rootDir>/../shared/src/index.ts',

    // TypeScript source uses NodeNext-style imports such as:
    //   import { foo } from './foo.js'
    // During Jest execution the actual source file is ./foo.ts, so strip
    // the .js extension when resolving relative imports.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.[tj]sx?$': [
      tsJestPath,
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/__tests__/**',
    '!src/react/**',
  ],
};
