import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

// GET /api/health: is the API up, and can it reach the database?
// Docker, a load balancer or an uptime monitor can call this every few
// seconds, so it is not rate limited and gives away nothing but up or down.
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Is the API running and connected to the database?' })
  @ApiResponse({ status: 200, description: 'Everything is up' })
  @ApiResponse({ status: 503, description: 'The database cannot be reached' })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) };
  }
}
