import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth System Tests', () => {
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

  it('should register a new user', async () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Jessica',
        email: 'jessica@test.com',
        password: '123456',
        role: 'customer',
      })
      .expect(201);
  });

  it('should reject registration with missing fields', async () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'missing@test.com',
      })
      .expect(400);
  });

  it('should login a user', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'jessica@test.com',
        password: '123456',
      })
      .expect(200);
  });
});