// startup check for secrets that are missing or still the example value
//
// the .env.example values (like JWT_ACCESS_SECRET=your_super_secret_...) are
// fine on our laptops, but if a server ever ran with them anyone could sign
// their own login tokens. so in production the app refuses to start, and in
// development it just prints a warning (should-fix 2 in the client's code
// review). main.ts calls this before the app starts listening.

// secrets that must be set to something real in production
export const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET'];
// checked only when they're set, since not every deployment uses them
export const OPTIONAL_SECRETS = ['JWT_REFRESH_SECRET'];
export const MIN_SECRET_LENGTH = 32;

// returns one line per problem, or an empty list when everything is fine
export function findSecretProblems(get: (key: string) => string | undefined): string[] {
  const problems: string[] = [];

  const check = (key: string, required: boolean) => {
    const value = get(key);
    if (!value) {
      if (required) problems.push(`${key} is not set`);
      return;
    }
    if (value.startsWith('your_')) {
      problems.push(`${key} is still the example value from .env.example`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} is shorter than ${MIN_SECRET_LENGTH} characters`);
    }
  };

  REQUIRED_SECRETS.forEach((key) => check(key, true));
  OPTIONAL_SECRETS.forEach((key) => check(key, false));
  return problems;
}
