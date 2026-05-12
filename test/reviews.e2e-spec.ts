import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Reviews and Ratings System Tests', () => {
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

  it('should create a customer review', async () => {
    return request(app.getHttpServer())
      .post('/reviews')
      .send({
        service: 'Home Cleaning',
        provider: 'LILO Cleaners',
        rating: 5,
        comment: 'Helpful and reliable service.',
      })
      .expect(201);
  });

  it('should reject rating above 5', async () => {
    return request(app.getHttpServer())
      .post('/reviews')
      .send({
        service: 'Home Cleaning',
        provider: 'LILO Cleaners',
        rating: 6,
        comment: 'Invalid rating',
      })
      .expect(400);
  });

  it('should reject review without comment', async () => {
    return request(app.getHttpServer())
      .post('/reviews')
      .send({
        service: 'Home Cleaning',
        provider: 'LILO Cleaners',
        rating: 4,
      })
      .expect(400);
  });

  it('should return all reviews', async () => {
    return request(app.getHttpServer())
      .get('/reviews')
      .expect(200);
  });
});