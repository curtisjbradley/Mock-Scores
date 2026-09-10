/** @type {import('ts-jest').JestConfigWithTsJest} */
const tsJestPath = require.resolve('ts-jest');

module.exports = {
  testEnvironment: 'node',

  roots: ['<rootDir>/src', '<rootDir>/testing'],

  testMatch: [
    '**/testing/**/*.test.ts',
    '**/__tests__/**/*.test.ts',
  ],

  // Run all test files in a single worker process. This means:
  //  - jose's Web Crypto cold-start happens exactly once per run
  //  - the signed test JWT is cached in module scope across all test files
  //  - total suite time is lower than paying the cold-start cost
  //    once per parallel Jest worker
  maxWorkers: 1,

  moduleNameMapper: {
    '^.*/db$': '<rootDir>/testing/mocks/db.ts',
    '^@mock-scores/shared$': '<rootDir>/../shared/src/index.ts',

    // TypeScript source may use NodeNext-style imports such as:
    //   import { foo } from './foo.js'
    //
    // During Jest execution the actual source file is ./foo.ts, so strip
    // the .js extension when resolving relative imports.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // jose is ESM distributed as JavaScript inside node_modules.
  // Normally Jest skips transforms for node_modules, so explicitly allow
  // jose through the ts-jest transform.
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],

  transform: {
    // Transform both TypeScript application/test files and JavaScript
    // dependencies such as jose through the same ts-jest configuration.
    //
    // isolatedModules is configured in tsconfig.jest.json rather than here.
    '^.+\\.[tj]sx?$': [
      tsJestPath,
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },

  setupFilesAfterEnv: [
    '<rootDir>/testing/setup.ts',
  ],

  // Only instrument application source.
  collectCoverageFrom: [
    'src/**/*.ts',
  ],

  coveragePathIgnorePatterns: [
    'src/db\\.ts',
    'src/app\\.ts',
  ],
};