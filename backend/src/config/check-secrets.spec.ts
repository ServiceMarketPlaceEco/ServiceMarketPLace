// Unit tests for the startup secret check (should-fix 2 in the code review)
// Run with: npm test

import { findSecretProblems, MIN_SECRET_LENGTH } from './check-secrets';

const env = (values: Record<string, string | undefined>) => (key: string) => values[key];
const strong = 'x'.repeat(MIN_SECRET_LENGTH);

describe('findSecretProblems', () => {
  it('is happy with a long, real secret', () => {
    expect(findSecretProblems(env({ JWT_ACCESS_SECRET: strong }))).toEqual([]);
  });

  it('flags a missing access secret', () => {
    expect(findSecretProblems(env({}))).toEqual(['JWT_ACCESS_SECRET is not set']);
  });

  it('flags the example value from .env.example', () => {
    const problems = findSecretProblems(
      env({ JWT_ACCESS_SECRET: 'your_super_secret_access_key_change_in_production' }),
    );
    expect(problems).toEqual(['JWT_ACCESS_SECRET is still the example value from .env.example']);
  });

  it('flags a secret that is too short to be safe', () => {
    expect(findSecretProblems(env({ JWT_ACCESS_SECRET: 'short' }))).toEqual([
      `JWT_ACCESS_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`,
    ]);
  });

  it('only checks the refresh secret when it is set', () => {
    expect(findSecretProblems(env({ JWT_ACCESS_SECRET: strong }))).toEqual([]);
    expect(findSecretProblems(env({ JWT_ACCESS_SECRET: strong, JWT_REFRESH_SECRET: 'your_refresh' }))).toEqual([
      'JWT_REFRESH_SECRET is still the example value from .env.example',
    ]);
  });
});
