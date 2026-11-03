// rate limits for the routes that need a tighter limit than the global one
//
// app.module.ts turns the ThrottlerGuard on for every route, with a generous
// default (RATE_LIMIT requests per client every RATE_LIMIT_WINDOW_MS). these
// two decorators lower that for the routes that need it:
//   @AiThrottle()   -> routes that call OpenAI or Claude (chatbot, voice search,
//                      Screen with AI), so nobody can run up the bill
//                      (AI_RATE_LIMIT, default 20 a minute)
//   @AuthThrottle() -> login, password reset and the phone code routes, so
//                      passwords and codes can't be guessed over and over
//                      (AUTH_RATE_LIMIT, default 5 a minute). this was
//                      must-fix 3 in the client's code review
//
// the limits are read from the environment when each request comes in, so
// changing them in .env and restarting is all you need.

import { Throttle } from '@nestjs/throttler';

// reads a positive number from the environment, or uses the fallback
const fromEnv = (key: string, fallback: number) => () => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const AiThrottle = () =>
  Throttle({
    default: {
      limit: fromEnv('AI_RATE_LIMIT', 20),
      ttl: fromEnv('AI_RATE_LIMIT_WINDOW_MS', 60_000),
    },
  });

export const AuthThrottle = () =>
  Throttle({
    default: {
      limit: fromEnv('AUTH_RATE_LIMIT', 5),
      ttl: fromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
    },
  });
