/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/testing'],
  testMatch: ['**/testing/**/*.test.ts', '**/__tests__/**/*.test.ts'],

  // Run all test files in a single worker process. This means:
  //  - jose's Web Crypto cold-start (~2.5s) happens exactly once per run
  //  - the signed test JWT is cached in module scope across all test files
  //  - total suite time drops by ~20s vs 1 cold-start per parallel worker
  maxWorkers: 1,

  moduleNameMapper: {
    '^.*/db$': '<rootDir>/testing/mocks/db.ts',
    '^@mock-scores/shared$': '<rootDir>/../shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Transform jose (ESM) through ts-jest
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/testing/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'testing/**/*.ts'
  ],
  coveragePathIgnorePatterns: [
      'src/db\\.ts',
      'src/app\\.ts',
      'testing/.*\\.ts',
  ],
};
