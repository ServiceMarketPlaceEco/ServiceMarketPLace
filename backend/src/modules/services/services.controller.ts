import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, ServiceResponseDto } from './dto';
import { JwtAuthGuard, AdminGuard } from '../auth/guards';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active services' })
  @ApiResponse({ status: 200, description: 'List of services', type: [ServiceResponseDto] })
  async findAll() {
    return this.servicesService.findAll();
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
