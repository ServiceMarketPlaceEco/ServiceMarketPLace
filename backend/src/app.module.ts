import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { AdminsModule } from './modules/admins/admins.module';
import { ServicesModule } from './modules/services/services.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MailModule } from './modules/mail/mail.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'servicehub'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<string>('NODE_ENV') === 'development',
        timezone: 'Z',
      }),
      inject: [ConfigService],
    }),

    // Rate limiting, applied to every route through the APP_GUARD below.
    // this is the default limit for each client (RATE_LIMIT requests every
    // RATE_LIMIT_WINDOW_MS). routes that need a tighter one use @AiThrottle()
    // or @AuthThrottle() from common/decorators/throttle.decorator.ts.
    // before, only the AI routes were limited, so login, password reset and
    // the phone codes could be guessed without limit (code review must-fix 3)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get('RATE_LIMIT_WINDOW_MS', 60_000)),
          limit: Number(configService.get('RATE_LIMIT', 120)),
        },
      ],
      inject: [ConfigService],
    }),

    // Feature modules
    AuthModule,
    CustomersModule,
    ProvidersModule,
    AdminsModule,
    ServicesModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    ReportsModule,
    MailModule,
    ChatbotModule,
    ChatModule,
  ],
  providers: [
    // every route goes through the rate limiter (see ThrottlerModule above)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
