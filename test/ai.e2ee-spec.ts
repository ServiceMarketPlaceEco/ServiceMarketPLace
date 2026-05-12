import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AI Voice Recognition System Tests', () => {
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

  it('should accept a voice search request', async () => {
    return request(app.getHttpServer())
      .post('/ai/voice-search')
      .send({
        text: 'I need medicine pickup in Laxmipur Rajshahi',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toHaveProperty('message');
      });
  });

  it('should reject empty voice search text', async () => {
    return request(app.getHttpServer())
      .post('/ai/voice-search')
      .send({
        text: '',
      })
      .expect(400);
  });
});