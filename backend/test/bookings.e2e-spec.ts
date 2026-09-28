

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { BookingsController } from '../src/modules/bookings/bookings.controller';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { Booking, BookingStatus } from '../src/modules/bookings/entities/booking.entity';
import { ProviderService } from '../src/modules/providers/entities/provider-service.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

describe('Bookings endpoints (integration)', () => {
  let app: INestApplication;
  let bookingRepo: any;
  let providerServiceRepo: any;
  let customerRepo: any;
  let providerRepo: any;

  function customerToken() {
    customerRepo.findOne.mockResolvedValue({
      customerId: 'cust-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  }

  beforeAll(async () => {
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [BookingsController],
      providers: [
        BookingsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: mockRepo() },
        {
          provide: MailService,
          useValue: {
            sendBookingConfirmation: jest.fn(),
            sendBookingCancellation: jest.fn(),
            sendBookingStatusUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyMainConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bookings (customer only)', () => {
    const validBooking = {
      date: '2026-09-15',
      time: '10:00',
      serviceName: 'Home Cleaning',
      address: 'Boalia, Rajshahi',
    };

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).post('/api/bookings').send(validBooking).expect(401);
    });

    it('returns 403 when a provider tries to book like a customer', async () => {
      providerRepo.findOne.mockResolvedValue({
        providerId: 'prov-1',
        isActive: true,
        isBlocked: false,
      });
      const token = signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBooking)
        .expect(403);
    });

    it('lets a customer create a booking, returns 201 pending', async () => {
      const token = customerToken();

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBooking)
        .expect(201);

      expect(res.body.customerId).toBe('cust-1');
      expect(res.body.status).toBe(BookingStatus.PENDING);
    });

    it('returns 400 when the date isnt a proper date string', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBooking, date: 'next tuesday maybe' })
        .expect(400);
    });

    it('returns 400 when the time is missing', async () => {
      const token = customerToken();
      const { time, ...noTime } = validBooking;

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(noTime)
        .expect(400);
    });

    it('returns 404 when booking a provider service that doesnt exist', async () => {
      const token = customerToken();
      providerServiceRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBooking, providerServiceId: 'ghost-service' })
        .expect(404);
    });
  });

  describe('GET /api/bookings/my-bookings (customer only)', () => {
    it('returns the customers bookings with a valid token', async () => {
      const token = customerToken();
      bookingRepo.find.mockResolvedValue([
        { bookingId: 'b-1', customerId: 'cust-1', status: BookingStatus.PENDING },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/bookings/my-bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].bookingId).toBe('b-1');
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/bookings/my-bookings').expect(401);
    });
  });

  describe('GET /api/bookings/all (public demo endpoint)', () => {
    it('returns bookings without any auth, this is the demo admin dashboard route', async () => {
      bookingRepo.find.mockResolvedValue([{ bookingId: 'b-1' }]);

      const res = await request(app.getHttpServer()).get('/api/bookings/all').expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PATCH /api/bookings/:id/status (public demo endpoint)', () => {
    it('maps a frontend status label onto the enum and saves it', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });

      const res = await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .send({ status: 'Accepted' })
        .expect(200);

      expect(res.body.status).toBe(BookingStatus.CONFIRMED);
    });

    it('returns 400 for a status label it doesnt know', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });

      await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .send({ status: 'teleported' })
        .expect(400);
    });

    it('returns 404 for a booking that doesnt exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/bookings/ghost/status')
        .send({ status: 'Accepted' })
        .expect(404);
    });
  });
});
