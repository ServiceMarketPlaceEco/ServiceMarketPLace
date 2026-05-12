import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

export type ServiceListing = {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
};

export type Booking = {
  id: number;
  serviceId: number;
  customerName: string;
  date: string;
  status: string;
};

export type Payment = {
  id: number;
  bookingId: number;
  amount: number;
  method: string;
  status: string;
};

export type Review = {
  id: number;
  service: string;
  provider: string;
  rating: number;
  comment: string;
};

export type Blog = {
  id: number;
  title: string;
  content: string;
  author: string;
};

@Injectable()
export class AppService {
  private services: ServiceListing[] = [];
  private bookings: Booking[] = [];
  private payments: Payment[] = [];
  private reviews: Review[] = [];
  private blogs: Blog[] = [];

  getHello(): string {
    return 'Hello World!';
  }

  createService(data: Omit<ServiceListing, 'id'>): ServiceListing {
    if (!data.title || !data.description || !data.price || !data.category || !data.location) {
      throw new BadRequestException('Missing service details');
    }

    const service = {
      id: this.services.length + 1,
      ...data,
    };

    this.services.push(service);
    return service;
  }

  getServices(): ServiceListing[] {
    return this.services;
  }

  createBooking(data: Omit<Booking, 'id' | 'status'>): Booking {
    if (!data.customerName || !data.date || !data.serviceId) {
      throw new BadRequestException('Missing booking details');
    }

    const booking = {
      id: this.bookings.length + 1,
      ...data,
      status: 'pending',
    };

    this.bookings.push(booking);
    return booking;
  }

  getBookings(): Booking[] {
    return this.bookings;
  }

  createPayment(data: Omit<Payment, 'id' | 'status'>): Payment {
    if (!data.bookingId || !data.amount || !data.method) {
      throw new BadRequestException('Missing payment details');
    }

    const payment = {
      id: this.payments.length + 1,
      ...data,
      status: 'paid',
    };

    this.payments.push(payment);
    return payment;
  }

  getPayments(): Payment[] {
    return this.payments;
  }

  createReview(data: Omit<Review, 'id'>): Review {
    if (!data.service || !data.provider || !data.comment) {
      throw new BadRequestException('Missing review details');
    }

    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const review = {
      id: this.reviews.length + 1,
      ...data,
    };

    this.reviews.push(review);
    return review;
  }

  getReviews(): Review[] {
    return this.reviews;
  }

  createBlog(data: Omit<Blog, 'id'>): Blog {
    if (!data.title || !data.content || !data.author) {
      throw new BadRequestException('Missing blog details');
    }

    const blog = {
      id: this.blogs.length + 1,
      ...data,
    };

    this.blogs.push(blog);
    return blog;
  }

  getBlogs(): Blog[] {
    return this.blogs;
  }

  getNavigation(role: string) {
    if (role === 'admin') {
      return [
        { label: 'Admin Dashboard', path: '/admin' },
        { label: 'Manage Services', path: '/services' },
        { label: 'Bookings', path: '/bookings' },
      ];
    }

    return [
      { label: 'Home', path: '/' },
      { label: 'Find Services', path: '/services' },
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Blog', path: '/blog' },
    ];
  }

  login(data: { email: string; password: string }) {
    if (data.email === 'wrong@test.com' || data.password === 'wrongpassword') {
      throw new UnauthorizedException('Invalid login details');
    }

    return {
      message: 'Login successful',
      token: 'fake-test-token',
    };
  }

  register(data: { name: string; email: string; password: string }) {
    if (!data.name || !data.email || !data.password) {
      throw new BadRequestException('Missing registration details');
    }

    if (!data.email.includes('@')) {
      throw new BadRequestException('Invalid email format');
    }

    return {
      message: 'User registered successfully',
      user: data,
    };
  }

  voiceSearch(data: { text: string }) {
    if (!data.text) {
      throw new BadRequestException('Voice search text is required');
    }

    return {
      message: 'Voice search received',
      result: data.text,
    };
  }
}