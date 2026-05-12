import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Service Listings System Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a service listing', async () => {
    return request(app.getHttpServer())
      .post('/services')
      .send({
        title: 'Daily Bazaar Shopping',
        description: 'Fresh grocery and bazaar shopping from local Rajshahi markets',
        price: 150,
        category: 'Shopping',
        location: 'Rajshahi University Area',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBeDefined();
        expect(body.title).toBe('Daily Bazaar Shopping');
      });
  });

  it('should return all service listings', async () => {
    return request(app.getHttpServer())
      .get('/services')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
      });
  });

  it('should reject service listing with missing title', async () => {
    return request(app.getHttpServer())
      .post('/services')
      .send({
        price: 80,
        category: 'Cleaning',
      })
      .expect(400);
  });

  it('should reject service listing outside Rajshahi division', async () => {
    return request(app.getHttpServer())
      .post('/services')
      .send({
        title: 'Parcel Delivery',
        description: 'Local document, parcel and food delivery across Rajshahi city',
        price: 120,
        category: 'Delivery',
        location: 'Melbourne',
      })
      .expect(400);
  });
});
