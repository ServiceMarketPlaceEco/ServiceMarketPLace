import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const controller = new HealthController({ query: jest.fn(async () => [{ 1: 1 }]) } as any);

    expect(await controller.check()).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('answers 503 when the database cannot be reached, without leaking why', async () => {
    const controller = new HealthController({ query: jest.fn(async () => { throw new Error('ECONNREFUSED 10.0.0.5') }) } as any);

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    await controller.check().catch((error) => {
      expect(JSON.stringify(error.getResponse())).not.toContain('10.0.0.5');
    });
  });
});
