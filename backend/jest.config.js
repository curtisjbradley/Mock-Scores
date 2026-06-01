/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/testing'],
  testMatch: ['**/testing/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^../db$': '<rootDir>/testing/mocks/db.ts',
    '^./db$': '<rootDir>/testing/mocks/db.ts',
    '^.*/src/db$': '<rootDir>/testing/mocks/db.ts',
  },
  // Transform jose (ESM) through ts-jest
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
    '^.+\\.js$': ['ts-jest', {}],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'testing/**/*.ts'
  ],
  coveragePathIgnorePatterns: [
      'src/db.ts',
      'src/app.ts',
      'testing/**/*.ts',
      ]
};
