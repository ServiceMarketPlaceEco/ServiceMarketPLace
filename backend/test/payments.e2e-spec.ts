// Integration tests for the payment endpoints.
// Real Nest app, real JwtAuthGuard and CustomerGuard, real validation pipe. Only the database and mail are mocked.
// Scope note, because this one is easy to misread: there is no payment gateway wired up. The service records a payment and marks it completed straight away. So what I'm testing here is the recording, the ownership check and the duplicate payment rule. I am not testing a real transaction, because there isn't one to test yet.
// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { Payment, PaymentStatus } from '../src/modules/payments/entities/payment.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const BOOKING_ID = '9b2c1d3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e';

describe('Payment endpoints (integration)', () => {
  let app: INestApplication;
  let paymentRepo: any;
  let bookingRepo: any;
  let customerRepo: any;
  let providerRepo: any;
  let mailService: any;

  function customerToken(id = 'cust-1') {
    customerRepo.findOne.mockResolvedValue({
      customerId: id,
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: id, email: 'c@x.com', userType: 'customer' });
  }

  function providerTokenValue() {
    providerRepo.findOne.mockResolvedValue({
      providerId: 'prov-1',
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: 'prov-1', email: 'p@x.com', userType: 'provider' });
  }

  beforeAll(async () => {
    paymentRepo = mockRepo();
    bookingRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    mailService = { sendPaymentConfirmation: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: mockRepo() },
        { provide: MailService, useValue: mailService },
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

  // ---------- authorisation ----------

  describe('authorisation', () => {
    it('rejects a payment with no token (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(401);
    });

    it('rejects a provider trying to record a payment (403)', async () => {
      const token = providerTokenValue();

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(403);
    });

    it('rejects listing payments with no token (401)', async () => {
      await request(app.getHttpServer()).get('/api/payments').expect(401);
    });
  });

  // ---------- recording a payment ----------

  describe('POST /api/payments', () => {
    function ownedBooking() {
      return { bookingId: BOOKING_ID, customerId: 'cust-1', paymentId: null };
    }

    it('records a payment for the customers own booking', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(201);

      expect(res.body.paymentId).toBe('pay-1');
      // The payer comes from the token, not from anything in the body.
      expect(res.body.customerId).toBe('cust-1');
    });

    it('marks it completed straight away because there is no gateway yet', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(201);

      // I'm recording what the code does today, not saying it's right. Once a real
      // gateway goes in, this should expect PENDING first and then completed after
      // the gateway confirms.
      expect(res.body.status).toBe(PaymentStatus.COMPLETED);
    });

    it('returns 403 when paying for someone elses booking', async () => {
      const token = customerToken('cust-2');
      bookingRepo.findOne.mockResolvedValue(ownedBooking());

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(403);

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('returns 404 for a booking that doesnt exist', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(404);
    });

    it('returns 400 when the booking is already paid', async () => {
      const token = customerToken();
      bookingRepo.findOne.mockResolvedValue(ownedBooking());
      paymentRepo.findOne.mockResolvedValue({ paymentId: 'pay-existing' });

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'cash' })
        .expect(400);
    });

    // ---- validation ----

    it('rejects a negative amount (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: -100, paymentMethod: 'cash' })
        .expect(400);
    });

    it('rejects a payment method that isnt in the enum (400)', async () => {
      const token = customerToken();

      // The client mentioned SSLCommerz, but it isn't implemented. I want it
      // rejected clearly rather than silently accepted and stored as if it worked.
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: 'sslcommerz' })
        .expect(400);
    });

    it('rejects a bookingId that isnt a uuid (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: 'not-a-uuid', amount: 500, paymentMethod: 'cash' })
        .expect(400);
    });

    it('rejects a body trying to set the status directly (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_ID,
          amount: 500,
          paymentMethod: 'cash',
          status: 'completed',
        })
        .expect(400);
    });

    it('accepts every method that is in the enum', async () => {
      const methods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'];

      for (const method of methods) {
        jest.clearAllMocks();
        const token = customerToken();
        bookingRepo.findOne.mockResolvedValue(ownedBooking());
        paymentRepo.findOne.mockResolvedValue(null);
        paymentRepo.save.mockImplementation(async (p: any) => ({ ...p, paymentId: 'pay-1' }));

        await request(app.getHttpServer())
          .post('/api/payments')
          .set('Authorization', `Bearer ${token}`)
          .send({ bookingId: BOOKING_ID, amount: 500, paymentMethod: method })
          .expect(201);
      }
    });
  });

  // ---------- reading payments ----------

  describe('GET /api/payments', () => {
    it('only returns the signed in customers payments', async () => {
      const token = customerToken();
      paymentRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.where.customerId).toBe('cust-1');
    });

    it('filters by status from the query string', async () => {
      const token = customerToken();
      paymentRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/payments?status=refunded')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const [options] = paymentRepo.find.mock.calls[0];
      expect(options.where.status).toBe(PaymentStatus.REFUNDED);
    });

    it('rejects a status that isnt in the enum (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .get('/api/payments?status=banana')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /api/payments/:id', () => {
    it('returns 404 for a payment that doesnt exist', async () => {
      const token = customerToken();
      paymentRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/payments/ghost')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
