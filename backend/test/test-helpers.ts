

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// one secret used for signing and verifying jwts in the tests
export const TEST_JWT_SECRET = 'integration-test-secret';

// fake ConfigService that hands back the test secret instead of reading .env
export const testConfigService = {
  provide: ConfigService,
  useValue: {
    get: (key: string, fallback?: any) => {
      if (key === 'JWT_ACCESS_SECRET') return TEST_JWT_SECRET;
      return fallback;
    },
  },
};

// same mock repo idea as the unit tests, every db call is a jest mock
export const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  // the admin lists are paginated so they use findAndCount
  findAndCount: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  remove: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

// applies the exact same validation pipe as src/main.ts so requests get
// validated the same way they would in the real running app
export function applyMainConfig(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.setGlobalPrefix('api');
}

// signs a real jwt like the backend would, so the real JwtStrategy and
// guards can verify it, no faking the auth layer
export function signTestToken(payload: { sub: string; email: string; userType: string }) {
  const jwt = new JwtService({ secret: TEST_JWT_SECRET });
  return jwt.sign(payload, { expiresIn: '15m' });
}
