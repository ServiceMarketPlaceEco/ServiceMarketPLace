// Run with: npm run test:e2e

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import {
  BlockReport,
  ReporterType,
  ReportedType,
  ReportStatus,
} from '../src/modules/reports/entities/block-report.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { ServiceProvider } from '../src/modules/providers/entities/service-provider.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { mockRepo, testConfigService, applyMainConfig, signTestToken } from './test-helpers';

const PROVIDER_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('Report endpoints (integration)', () => {
  let app: INestApplication;
  let reportRepo: any;
  let customerRepo: any;
  let providerRepo: any;
  let adminRepo: any;

  function customerToken(id = 'cust-1') {
    customerRepo.findOne.mockResolvedValue({
      customerId: id,
      isActive: true,
      isBlocked: false,
    });
    return signTestToken({ sub: id, email: 'c@x.com', userType: 'customer' });
  }

  function adminToken() {
    adminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@servicehub.local',
      role: 'admin',
      isActive: true,
    });
    return signTestToken({ sub: 'admin-1', email: 'admin@servicehub.local', userType: 'admin' });
  }

  beforeAll(async () => {
    reportRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();
    adminRepo = mockRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ReportsController],
      providers: [
        ReportsService,
        JwtStrategy,
        testConfigService,
        { provide: getRepositoryToken(BlockReport), useValue: reportRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(ServiceProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Admin), useValue: adminRepo },
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

  // ---------- filing a report ----------

  describe('POST /api/reports', () => {
    it('rejects a report with no token (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/reports')
        .send({ reportedId: PROVIDER_UUID, reportedType: 'provider', reason: 'no show' })
        .expect(401);
    });

    it('lets a signed in customer report a provider', async () => {
      const token = customerToken();
      providerRepo.findOne.mockResolvedValue({ providerId: PROVIDER_UUID });
      reportRepo.save.mockImplementation(async (r: any) => ({ ...r, reportId: 'rep-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reportedId: PROVIDER_UUID,
          reportedType: 'provider',
          reason: 'did not turn up for the booking',
        })
        .expect(201);

      expect(res.body.reportId).toBe('rep-1');
      // The reporter comes from the token.
      expect(res.body.reporterId).toBe('cust-1');
      expect(res.body.reporterType).toBe(ReporterType.CUSTOMER);
    });

    it('a new report starts pending, nothing is auto actioned', async () => {
      const token = customerToken();
      providerRepo.findOne.mockResolvedValue({ providerId: PROVIDER_UUID });
      reportRepo.save.mockImplementation(async (r: any) => ({ ...r, reportId: 'rep-1' }));

      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportedId: PROVIDER_UUID, reportedType: 'provider', reason: 'rude' })
        .expect(201);

      expect(res.body.status).toBe(ReportStatus.PENDING);
      // Filing a report must never block anyone on its own. Same rule as the fake
      // review queue, a person decides, not the system.
      expect(providerRepo.update).not.toHaveBeenCalled();
    });

    it('returns 404 when reporting someone who doesnt exist', async () => {
      const token = customerToken();
      providerRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportedId: PROVIDER_UUID, reportedType: 'provider', reason: 'ghost' })
        .expect(404);
    });

    it('rejects an empty reason (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportedId: PROVIDER_UUID, reportedType: 'provider', reason: '' })
        .expect(400);
    });

    it('rejects a reportedType that isnt in the enum (400)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportedId: PROVIDER_UUID, reportedType: 'alien', reason: 'x' })
        .expect(400);
    });

    it('rejects a body trying to set the status directly (400)', async () => {
      const token = customerToken();

      // Someone filing a report must not be able to mark it resolved themselves.
      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reportedId: PROVIDER_UUID,
          reportedType: 'provider',
          reason: 'x',
          status: 'resolved',
        })
        .expect(400);
    });
  });

  // ---------- own reports ----------

  describe('GET /api/reports/my-reports', () => {
    it('only returns reports the signed in user filed', async () => {
      const token = customerToken();
      reportRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where).toEqual({ reporterId: 'cust-1' });
    });
  });

  // ---------- admin only ----------

  describe('admin only routes', () => {
    it('blocks a customer from reading the whole report queue (403)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('blocks a customer from changing a report status (403)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/reports/rep-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'resolved' })
        .expect(403);
    });

    it('blocks a customer from blocking the reported user (403)', async () => {
      const token = customerToken();

      await request(app.getHttpServer())
        .put('/api/reports/rep-1/block-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(providerRepo.update).not.toHaveBeenCalled();
    });

    it('lets an admin read the whole queue', async () => {
      const token = adminToken();
      reportRepo.find.mockResolvedValue([{ reportId: 'rep-1' }]);

      const res = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('lets an admin filter the queue by status', async () => {
      const token = adminToken();
      reportRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/reports?status=pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where.status).toBe(ReportStatus.PENDING);
    });

    it('records which admin resolved a report', async () => {
      const token = adminToken();
      reportRepo.findOne.mockResolvedValue({
        reportId: 'rep-1',
        status: ReportStatus.PENDING,
      });

      const res = await request(app.getHttpServer())
        .put('/api/reports/rep-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'resolved', adminNotes: 'warning issued' })
        .expect(200);

      expect(res.body.status).toBe(ReportStatus.RESOLVED);
      expect(res.body.resolvedBy).toBe('admin-1');
      expect(res.body.adminNotes).toBe('warning issued');
    });

    it('rejects a status that isnt in the enum (400)', async () => {
      const token = adminToken();

      await request(app.getHttpServer())
        .put('/api/reports/rep-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'banana' })
        .expect(400);
    });

    it('lets an admin block the reported provider and closes the report', async () => {
      const token = adminToken();
      const report: any = {
        reportId: 'rep-1',
        reportedId: PROVIDER_UUID,
        reportedType: ReportedType.PROVIDER,
        status: ReportStatus.PENDING,
      };
      reportRepo.findOne.mockResolvedValue(report);

      await request(app.getHttpServer())
        .put('/api/reports/rep-1/block-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(providerRepo.update).toHaveBeenCalledWith(
        { providerId: PROVIDER_UUID },
        { isBlocked: true },
      );
      expect(report.status).toBe(ReportStatus.RESOLVED);
    });

    it('returns 404 when acting on a report that doesnt exist', async () => {
      const token = adminToken();
      reportRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put('/api/reports/ghost/block-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
