import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Payment System Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should pay for a booking', async () => {
    const serviceResponse = await request(app.getHttpServer())
      .post('/services')
      .send({
        title: 'Medicine Pickup',
        description: 'Pick up pharmacy orders and deliver them safely to your home',
        price: 120,
        category: 'Health errands',
        location: 'Laxmipur',
      })
      .expect(201);

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        serviceId: serviceResponse.body.id,
        customerName: 'Karim',
        date: '2026-06-01',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/payments')
      .send({
        bookingId: bookingResponse.body.id,
        amount: serviceResponse.body.price,
        method: 'card',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.bookingId).toBe(bookingResponse.body.id);
        expect(body.status).toBe('paid');
      });
  });

  it('should return all payments', async () => {
    return request(app.getHttpServer()).get('/payments').expect(200);
  });

  it('should reject payment with missing method', async () => {
    return request(app.getHttpServer())
      .post('/payments')
      .send({
        bookingId: 1,
        amount: 80,
      })
      .expect(400);
  });
});
