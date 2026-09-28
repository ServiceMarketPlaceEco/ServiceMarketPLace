import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminsService } from './admins.service';
import { CreateAdminDto, UpdateAdminDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../auth/guards';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admins')
@Controller('admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new admin (super_admin only)' })
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminsService.create(createAdminDto);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all admins' })
  findAll() {
    return this.adminsService.findAll();
  }

  @Get('dashboard')
  @Roles('admin')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboardStats() {
    return this.adminsService.getDashboardStats();
  }

  @Get('customers')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all customers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAllCustomers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminsService.getAllCustomers(page || 1, limit || 10);
  }

  @Get('providers')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all providers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAllProviders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminsService.getAllProviders(page || 1, limit || 10);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get admin by ID' })
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update admin' })
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminsService.update(id, updateAdminDto);
  }

  @Post(':id/deactivate')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate admin' })
  deactivate(@Param('id') id: string) {
    return this.adminsService.deactivate(id);
  }

  @Post(':id/activate')
  @Roles('admin')
  @ApiOperation({ summary: 'Activate admin' })
  activate(@Param('id') id: string) {
    return this.adminsService.activate(id);
  }

  @Post('providers/:id/verify')
  @Roles('admin')
  @ApiOperation({ summary: 'Verify a service provider' })
  verifyProvider(@Param('id') id: string) {
    return this.adminsService.verifyProvider(id);
  }

  @Post('users/:userType/:id/suspend')
  @Roles('admin')
  @ApiOperation({ summary: 'Suspend a user (customer or provider)' })
  suspendUser(
    @Param('userType') userType: 'customer' | 'provider',
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.adminsService.suspendUser(userType, id, reason);
  }

  @Post('users/:userType/:id/activate')
  @Roles('admin')
  @ApiOperation({ summary: 'Activate a suspended user' })
  activateUser(
    @Param('userType') userType: 'customer' | 'provider',
    @Param('id') id: string,
  ) {
    return this.adminsService.activateUser(userType, id);
  }
}
