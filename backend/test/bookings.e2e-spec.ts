

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
  let adminRepo: any;

  function customerToken() {
    customerRepo.findOne.mockResolvedValue({
      customerId: 'cust-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'cust-1', email: 'c@x.com', userType: 'customer' });
  }

  // a signed in admin. the jwt strategy looks the admin up by id
  function adminToken() {
    adminRepo.findOne.mockResolvedValue({ id: 'admin-1', isActive: true });
    return signTestToken({ sub: 'admin-1', email: 'admin@servicehub.local', userType: 'admin' });
  }

  beforeAll(async () => {
    bookingRepo = mockRepo();
    providerServiceRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();

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
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
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
        isVerified: true, // approved by an admin
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

  // these two used to be public "for the demo admin dashboard" (must-fix 1 in
  // the client's code review). now the list is the guarded GET /bookings and
  // status changes need an admin, so nobody can read or change bookings
  // without signing in.
  describe('booking management is admin only', () => {
    it('GET /api/bookings/all is no longer public', async () => {
      await request(app.getHttpServer()).get('/api/bookings/all').expect(401);
    });

    it('GET /api/bookings returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/bookings').expect(401);
      expect(bookingRepo.find).not.toHaveBeenCalled();
    });

    it('GET /api/bookings returns 403 for a customer', async () => {
      const token = customerToken();
      await request(app.getHttpServer())
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /api/bookings lists every booking for an admin', async () => {
      bookingRepo.find.mockResolvedValue([{ bookingId: 'b-1' }]);
      const token = adminToken();

      const res = await request(app.getHttpServer())
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
    });

    it('PATCH /api/bookings/:id/status returns 401 without a token and changes nothing', async () => {
      await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .send({ status: 'completed', providerId: 'p-9' })
        .expect(401);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it('PATCH /api/bookings/:id/status returns 403 for a customer', async () => {
      const token = customerToken();
      await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'cancelled' })
        .expect(403);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/bookings/:id/status (admin)', () => {
    it('maps a frontend status label onto the enum and saves it', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });
      const token = adminToken();

      const res = await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Accepted' })
        .expect(200);

      expect(res.body.status).toBe(BookingStatus.CONFIRMED);
    });

    it('returns 400 for a status label it doesnt know', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', status: BookingStatus.PENDING });
      const token = adminToken();

      await request(app.getHttpServer())
        .patch('/api/bookings/b-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'teleported' })
        .expect(400);
    });

    it('returns 404 for a booking that doesnt exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      const token = adminToken();

      await request(app.getHttpServer())
        .patch('/api/bookings/ghost/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Accepted' })
        .expect(404);
    });
  });

  // used to answer 200 { error: 'Access denied' } (should-fix 6)
  describe('GET /api/bookings/:id', () => {
    it('returns 403 when a customer opens someone elses booking', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-2', customerId: 'cust-OTHER' });
      const token = customerToken();

      await request(app.getHttpServer())
        .get('/api/bookings/b-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns the booking to the customer who owns it', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 'b-1', customerId: 'cust-1' });
      const token = customerToken();

      const res = await request(app.getHttpServer())
        .get('/api/bookings/b-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.bookingId).toBe('b-1');
    });
  });
});
