import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Booking System Tests', () => {
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

  it('should create a booking for a service', async () => {
    const serviceResponse = await request(app.getHttpServer())
      .post('/services')
      .send({
        title: 'Tutoring Support',
        description: 'Online tutoring service for students',
        price: 50,
        category: 'Education',
        location: 'Uposhohor',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/bookings')
      .send({
        serviceId: serviceResponse.body.id,
        customerName: 'Jessica',
        date: '2026-05-06',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.serviceId).toBe(serviceResponse.body.id);
        expect(body.status).toBe('pending');
      });
  });

  it('should return all bookings', async () => {
    return request(app.getHttpServer())
      .get('/bookings')
      .expect(200);
  });

  it('should reject booking with missing customer name', async () => {
    return request(app.getHttpServer())
      .post('/bookings')
      .send({
        serviceId: 1,
        date: '2026-05-06',
      })
      .expect(400);
  });
});