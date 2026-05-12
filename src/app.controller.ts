import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AppService } from './app.service';

const rajshahiAreas = [
  'Motihar',
  'Shaheb Bazar',
  'Laxmipur',
  'Rajshahi University Area',
  'Uposhohor',
];

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Post('services')
  createService(@Body() body: any) {
    if (!body.title || !body.description || !body.price || !body.category || !body.location) {
      throw new BadRequestException('Missing service details');
    }

    if (!rajshahiAreas.includes(body.location)) {
      throw new BadRequestException('Location must be in Rajshahi');
    }

    return this.appService.createService(body);
  }

  @Get('services')
  getServices() {
    return this.appService.getServices();
  }

  @Post('bookings')
  createBooking(@Body() body: any) {
    if (!body.serviceId || !body.customerName || !body.date) {
      throw new BadRequestException('Missing booking details');
    }

    return this.appService.createBooking(body);
  }

  @Get('bookings')
  getBookings() {
    return this.appService.getBookings();
  }

  @Post('payments')
  createPayment(@Body() body: any) {
    if (!body.bookingId || !body.amount || !body.method) {
      throw new BadRequestException('Missing payment details');
    }

    return this.appService.createPayment(body);
  }

  @Get('payments')
  getPayments() {
    return this.appService.getPayments();
  }

  @Post('reviews')
  createReview(@Body() body: any) {
    return this.appService.createReview(body);
  }

  @Get('reviews')
  getReviews() {
    return this.appService.getReviews();
  }

  @Post('blogs')
  createBlog(@Body() body: any) {
    return this.appService.createBlog(body);
  }

  @Get('blogs')
  getBlogs() {
    return this.appService.getBlogs();
  }

  @Get('navigation')
  getNavigation(@Query('role') role: string) {
    return this.appService.getNavigation(role);
  }

  @HttpCode(200)
  @Post('auth/login')
  login(@Body() body: any) {
    return this.appService.login(body);
  }

  @Post('auth/register')
  register(@Body() body: any) {
    return this.appService.register(body);
  }

  @Post('ai/voice-search')
  voiceSearch(@Body() body: any) {
    return this.appService.voiceSearch(body);
  }

  @Get('admin/dashboard')
  getAdminDashboard() {
    throw new UnauthorizedException('Login required');
  }
}