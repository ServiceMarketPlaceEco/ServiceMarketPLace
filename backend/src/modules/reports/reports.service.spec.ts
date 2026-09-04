// Unit tests for ReportsService.
// This is the report a user feature plus the admin side that deals with them.
// I'm testing that a report saves, that you can't report someone who doesn't
// exist, that the admin can change the status, and that blocking the reported
// user works.
// Run with: npm test

import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  ReporterType,
  ReportedType,
  ReportStatus,
} from './entities/block-report.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x: any) => x),
  save: jest.fn(async (x: any) => x),
  update: jest.fn(),
  count: jest.fn(),
});

describe('ReportsService', () => {
  let service: ReportsService;
  let reportRepo: any;
  let customerRepo: any;
  let providerRepo: any;

  beforeEach(() => {
    reportRepo = mockRepo();
    customerRepo = mockRepo();
    providerRepo = mockRepo();

    service = new ReportsService(reportRepo, customerRepo, providerRepo);
  });

  describe('create', () => {
    it('lets a customer report a provider', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });
      reportRepo.save.mockImplementation(async (r: any) => ({ ...r, reportId: 'rep-1' }));

      const result = await service.create('cust-1', 'customer', {
        reportedId: 'p-1',
        reportedType: ReportedType.PROVIDER,
        reason: 'did not show up',
      } as any);

      expect(result.reportId).toBe('rep-1');
      expect(result.reporterId).toBe('cust-1');
      expect(result.reporterType).toBe(ReporterType.CUSTOMER);
    });

    it('lets a provider report a customer', async () => {
      customerRepo.findOne.mockResolvedValue({ customerId: 'c-1' });
      reportRepo.save.mockImplementation(async (r: any) => ({ ...r, reportId: 'rep-2' }));

      const result = await service.create('prov-1', 'provider', {
        reportedId: 'c-1',
        reportedType: ReportedType.CUSTOMER,
        reason: 'abusive messages',
      } as any);

      expect(result.reporterType).toBe(ReporterType.PROVIDER);
    });

    it('a new report always starts as pending', async () => {
      providerRepo.findOne.mockResolvedValue({ providerId: 'p-1' });
      reportRepo.save.mockImplementation(async (r: any) => ({ ...r, reportId: 'rep-1' }));

      const result = await service.create('cust-1', 'customer', {
        reportedId: 'p-1',
        reportedType: ReportedType.PROVIDER,
        reason: 'no show',
      } as any);

      // Filing a report never actions anything by itself. An admin has to look
      // at it first, same principle as the fake review queue.
      expect(result.status).toBe(ReportStatus.PENDING);
    });

    it('throws NotFoundException when reporting a provider that doesnt exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('cust-1', 'customer', {
          reportedId: 'ghost',
          reportedType: ReportedType.PROVIDER,
          reason: 'x',
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(reportRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when reporting a customer that doesnt exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('prov-1', 'provider', {
          reportedId: 'ghost',
          reportedType: ReportedType.CUSTOMER,
          reason: 'x',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns the report when it exists', async () => {
      reportRepo.findOne.mockResolvedValue({ reportId: 'rep-1' });

      const result = await service.findById('rep-1');
      expect(result.reportId).toBe('rep-1');
    });

    it('throws NotFoundException for a report that doesnt exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByReporter', () => {
    it('only returns reports the person filed themselves', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.findByReporter('cust-1');

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where).toEqual({ reporterId: 'cust-1' });
      expect(options.order).toEqual({ createdAt: 'DESC' });
    });
  });

  describe('findAll', () => {
    it('returns every report when no filter is given', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.findAll();

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where).toEqual({});
    });

    it('filters the admin queue by status', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.findAll({ status: ReportStatus.PENDING } as any);

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where.status).toBe(ReportStatus.PENDING);
    });

    it('filters by the type of user that was reported', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.findAll({ reportedType: ReportedType.PROVIDER } as any);

      const [options] = reportRepo.find.mock.calls[0];
      expect(options.where.reportedType).toBe(ReportedType.PROVIDER);
    });
  });

  describe('updateStatus', () => {
    it('records which admin resolved the report', async () => {
      reportRepo.findOne.mockResolvedValue({ reportId: 'rep-1', status: ReportStatus.PENDING });

      const result = await service.updateStatus('admin-1', 'rep-1', {
        status: ReportStatus.RESOLVED,
      } as any);

      expect(result.status).toBe(ReportStatus.RESOLVED);
      expect(result.resolvedBy).toBe('admin-1');
    });

    it('records the admin on a dismissed report too', async () => {
      reportRepo.findOne.mockResolvedValue({ reportId: 'rep-1', status: ReportStatus.PENDING });

      const result = await service.updateStatus('admin-1', 'rep-1', {
        status: ReportStatus.DISMISSED,
      } as any);

      expect(result.resolvedBy).toBe('admin-1');
    });

    it('doesnt set resolvedBy when the report is just marked reviewed', async () => {
      reportRepo.findOne.mockResolvedValue({ reportId: 'rep-1', status: ReportStatus.PENDING });

      const result = await service.updateStatus('admin-1', 'rep-1', {
        status: ReportStatus.REVIEWED,
      } as any);

      // Reviewed means an admin has looked but hasn't decided yet, so there's
      // nobody to record as having resolved it.
      expect(result.resolvedBy).toBeUndefined();
    });

    it('keeps the old admin notes when none are supplied', async () => {
      reportRepo.findOne.mockResolvedValue({
        reportId: 'rep-1',
        status: ReportStatus.PENDING,
        adminNotes: 'earlier note',
      });

      const result = await service.updateStatus('admin-1', 'rep-1', {
        status: ReportStatus.REVIEWED,
      } as any);

      expect(result.adminNotes).toBe('earlier note');
    });

    it('saves new admin notes when they are supplied', async () => {
      reportRepo.findOne.mockResolvedValue({
        reportId: 'rep-1',
        status: ReportStatus.PENDING,
        adminNotes: 'earlier note',
      });

      const result = await service.updateStatus('admin-1', 'rep-1', {
        status: ReportStatus.RESOLVED,
        adminNotes: 'user warned',
      } as any);

      expect(result.adminNotes).toBe('user warned');
    });
  });

  describe('blockReportedUser', () => {
    it('blocks a reported provider and closes the report', async () => {
      const report: any = {
        reportId: 'rep-1',
        reportedId: 'p-1',
        reportedType: ReportedType.PROVIDER,
        status: ReportStatus.PENDING,
      };
      reportRepo.findOne.mockResolvedValue(report);

      await service.blockReportedUser('rep-1');

      expect(providerRepo.update).toHaveBeenCalledWith(
        { providerId: 'p-1' },
        { isBlocked: true },
      );
      expect(report.status).toBe(ReportStatus.RESOLVED);
    });

    it('blocks a reported customer and closes the report', async () => {
      const report: any = {
        reportId: 'rep-1',
        reportedId: 'c-1',
        reportedType: ReportedType.CUSTOMER,
        status: ReportStatus.PENDING,
      };
      reportRepo.findOne.mockResolvedValue(report);

      await service.blockReportedUser('rep-1');

      expect(customerRepo.update).toHaveBeenCalledWith(
        { customerId: 'c-1' },
        { isBlocked: true },
      );
    });

    it('throws NotFoundException for a report that doesnt exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(service.blockReportedUser('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('counts the reports in each status', async () => {
      reportRepo.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4) // pending
        .mockResolvedValueOnce(2) // reviewed
        .mockResolvedValueOnce(3) // resolved
        .mockResolvedValueOnce(1); // dismissed

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 10,
        pending: 4,
        reviewed: 2,
        resolved: 3,
        dismissed: 1,
      });
    });
  });
});
