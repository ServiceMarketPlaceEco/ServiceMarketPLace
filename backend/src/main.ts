import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { findSecretProblems } from './config/check-secrets';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // refuse to start in production with a missing or example jwt secret,
  // otherwise anyone could sign their own login tokens. on our laptops it
  // just warns, so local setup still works with .env.example
  const secretProblems = findSecretProblems((key) => configService.get<string>(key));
  if (secretProblems.length) {
    const message = `Insecure configuration:\n  - ${secretProblems.join('\n  - ')}`;
    if (isProduction) {
      throw new Error(`${message}\nSet real values in the server's environment before starting.`);
    }
    console.warn(`${message}\n(This is only allowed outside production.)`);
  }

  // security headers on every response (should-fix 8). the content security
  // policy is left off outside production because it blocks the swagger page
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  // when the app sits behind a proxy or load balancer (most hosts), this makes
  // the rate limiter see each visitor's real ip instead of the proxy's, so one
  // busy user can't use up everyone's limit. set TRUST_PROXY=1 on the server
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
  }

  // Global validation pipe
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

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation, only outside production (should-fix 8). it lists
  // every endpoint, which is handy for us but not something to publish.
  // set ENABLE_SWAGGER=true to turn it on in production anyway
  const enableSwagger = !isProduction || configService.get<string>('ENABLE_SWAGGER') === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('ServiceHub API')
      .setDescription('API documentation for ServiceHub marketplace')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('customers', 'Customer management')
      .addTag('providers', 'Service provider management')
      .addTag('services', 'Service categories')
      .addTag('bookings', 'Booking management')
      .addTag('payments', 'Payment processing')
      .addTag('reviews', 'Review management')
      .addTag('reports', 'Report management')
      .addTag('admin', 'Admin operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  if (enableSwagger) {
    console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
