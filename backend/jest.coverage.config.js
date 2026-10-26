// Whole-backend coverage: runs the unit tests (src/**/*.spec.ts) and the
// integration tests (test/**/*.e2e-spec.ts) together and measures every source
// file, including controllers, guards and DTOs.
// Run with: npm run test:cov:all
// (npm run test:cov still runs the unit tests only, measured over services.)
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(src/.*\\.spec\\.ts|test/.*\\.e2e-spec\\.ts)$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: false }] },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: './coverage-all',
  coverageReporters: ['text-summary', 'html', 'json-summary'],
};
