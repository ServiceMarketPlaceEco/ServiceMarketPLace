import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Navigation Tests', () => {
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

  it('should return customer navigation', async () => {
    return request(app.getHttpServer())
      .get('/navigation?role=customer')
      .expect(200);
  });

  it('should return admin navigation', async () => {
    return request(app.getHttpServer())
      .get('/navigation?role=admin')
      .expect(200);
  });

  it('should hide admin dashboard from customers', async () => {
    return request(app.getHttpServer())
      .get('/navigation?role=customer')
      .expect(200)
      .expect((res) => {
        expect(res.body).not.toContain('Admin Dashboard');
      });
  });
});