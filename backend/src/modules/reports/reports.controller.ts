import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto, UpdateReportStatusDto, ReportQueryDto, ReportResponseDto } from './dto';
import { JwtAuthGuard, AdminGuard } from '../auth/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a report against a user' })
  @ApiResponse({ status: 201, description: 'Report submitted', type: ReportResponseDto })
  @ApiResponse({ status: 404, description: 'Reported user not found' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(
      user.userId,
      user.userType as 'customer' | 'provider',
      dto,
    );
  }

  @Get('my-reports')
  @ApiOperation({ summary: 'Get reports submitted by current user' })
  @ApiResponse({ status: 200, description: 'List of reports', type: [ReportResponseDto] })
  async findMyReports(@CurrentUser() user: CurrentUserData) {
    return this.reportsService.findByReporter(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({ status: 200, description: 'Report details', type: ReportResponseDto })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async findOne(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  // Admin endpoints
  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all reports (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all reports', type: [ReportResponseDto] })
  async findAll(@Query() query: ReportQueryDto) {
    return this.reportsService.findAll(query);
  }

  @Put(':id/status')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update report status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Report updated', type: ReportResponseDto })
  async updateStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(user.userId, id, dto);
  }

  @Put(':id/block-user')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Block reported user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User blocked' })
  async blockUser(@Param('id') id: string) {
    await this.reportsService.blockReportedUser(id);
    return { message: 'User blocked successfully' };
  }
}
