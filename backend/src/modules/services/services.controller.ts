import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, ServiceResponseDto, MatchTranscriptDto } from './dto';
import { ServiceMatchingService } from './matching/service-matching.service';
import { JwtAuthGuard, AdminGuard } from '../auth/guards';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly serviceMatchingService: ServiceMatchingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all active services' })
  @ApiResponse({ status: 200, description: 'List of services', type: [ServiceResponseDto] })
  async findAll() {
    return this.servicesService.findAll();
  }

  @Post('match-transcript')
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Find the services that best match a voice-search transcript' })
  @ApiResponse({ status: 200, description: 'Ranked service matches with confidence and reason' })
  @ApiResponse({ status: 429, description: 'Too many requests, try again shortly' })
  async matchTranscript(@Body() dto: MatchTranscriptDto) {
    return this.serviceMatchingService.matchTranscript(dto.transcript, dto.language);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiResponse({ status: 200, description: 'Service details', type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Get(':id/providers')
  @ApiOperation({ summary: 'Get providers offering a specific service' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findProvidersForService(@Param('id') id: string) {
    return this.servicesService.findProvidersForService(id);
  }

  // Admin only endpoints
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new service (Admin only)' })
  @ApiResponse({ status: 201, description: 'Service created', type: ServiceResponseDto })
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a service (Admin only)' })
  @ApiResponse({ status: 200, description: 'Service updated', type: ServiceResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a service (Admin only)' })
  @ApiResponse({ status: 200, description: 'Service deleted' })
  async remove(@Param('id') id: string) {
    await this.servicesService.remove(id);
    return { message: 'Service deleted successfully' };
  }
}
