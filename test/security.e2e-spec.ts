import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject wrong login details', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'wrong@test.com',
        password: 'wrongpassword',
      })
      .expect(401);
  });

  it('should block admin page without login', async () => {
    return request(app.getHttpServer())
      .get('/admin/dashboard')
      .expect(401);
  });
  it('should reject invalid email format', async () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Jessica',
        email: 'not-an-email',
        password: 'password123',
      })
      .expect(400);
  });

  it('should reject empty booking form', async () => {
    return request(app.getHttpServer())
      .post('/bookings')
      .send({})
      .expect(400);
  });

});