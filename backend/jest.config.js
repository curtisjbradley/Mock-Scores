/** @type {import('ts-jest').JestConfigWithTsJest} */
const tsJestPath = require.resolve('ts-jest');

module.exports = {
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
    // `isolatedModules: true` runs ts-jest in transpile-only mode: it strips
    // types per-file without a full type-check, which is the dominant cost in
    // ts-jest. Type safety is still enforced separately by `npm run build`
    // (tsc) and `npm run lint` in CI, so skipping it here only speeds up tests.
    '^.+\\.tsx?$': [tsJestPath, {
      tsconfig: 'tsconfig.jest.json',
      isolatedModules: true,
    }],
    '^.+\\.js$': [tsJestPath, {
      tsconfig: 'tsconfig.jest.json',
      isolatedModules: true,
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/testing/setup.ts'],
  // Only instrument application source. Test files were previously listed here
  // and then excluded via coveragePathIgnorePatterns — instrumenting them just
  // to drop them was wasted work.
  collectCoverageFrom: [
    'src/**/*.ts',
  ],
  coveragePathIgnorePatterns: [
      'src/db\\.ts',
      'src/app\\.ts',
  ],
};
