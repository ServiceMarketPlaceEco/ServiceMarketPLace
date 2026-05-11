import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Admin } from '../admins/entities/admin.entity';
import { RefreshToken, UserType } from './entities/refresh-token.entity';
import {
  RegisterCustomerDto,
  RegisterProviderDto,
  LoginDto,
  UserTypeDto,
  AuthResponseDto,
} from './dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  // Register Customer
  async registerCustomer(dto: RegisterCustomerDto): Promise<AuthResponseDto> {
    const existingCustomer = await this.customerRepository.findOne({
      where: { email: dto.email },
    });

    if (existingCustomer) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const customer = this.customerRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      age: dto.age,
      phone: dto.phone,
      address: dto.address,
    });

    await this.customerRepository.save(customer);

    // Send welcome email
    await this.mailService.sendWelcomeEmail(customer.email, customer.name);

    return this.generateTokens(customer.customerId, customer.email, 'customer', customer);
  }

  // Register Provider
  async registerProvider(dto: RegisterProviderDto): Promise<AuthResponseDto> {
    const existingProvider = await this.providerRepository.findOne({
      where: { email: dto.email },
    });

    if (existingProvider) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const provider = this.providerRepository.create({
      providerName: dto.providerName,
      email: dto.email,
      passwordHash,
      abn: dto.abn,
      address: dto.address,
      postalCode: dto.postalCode,
      phone: dto.phone,
      description: dto.description,
    });

    await this.providerRepository.save(provider);

    // Send welcome email
    await this.mailService.sendProviderWelcomeEmail(provider.email, provider.providerName);

    return this.generateTokens(provider.providerId, provider.email, 'provider', provider);
  }

  // Login
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    let user: Customer | ServiceProvider | Admin | null = null;
    let userId: string;
    let userType: UserType;

    switch (dto.userType) {
      case UserTypeDto.CUSTOMER:
        user = await this.customerRepository.findOne({
          where: { email: dto.email },
        });
        if (user) {
          userId = user.customerId;
          userType = UserType.CUSTOMER;
          if (user.isBlocked) {
            throw new UnauthorizedException('Your account has been blocked');
          }
          if (!user.isActive) {
            throw new UnauthorizedException('Your account is not active');
          }
        }
        break;

      case UserTypeDto.PROVIDER:
        user = await this.providerRepository.findOne({
          where: { email: dto.email },
        });
        if (user) {
          userId = user.providerId;
          userType = UserType.PROVIDER;
          if (user.isBlocked) {
            throw new UnauthorizedException('Your account has been blocked');
          }
          if (!user.isActive) {
            throw new UnauthorizedException('Your account is not active');
          }
        }
        break;

      case UserTypeDto.ADMIN:
        user = await this.adminRepository.findOne({
          where: { email: dto.email },
        });
        if (user) {
          userId = user.id;
          userType = UserType.ADMIN;
          if (!user.isActive) {
            throw new UnauthorizedException('Your account is not active');
          }
        }
        break;

      default:
        throw new BadRequestException('Invalid user type');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(userId!, user.email, userType!, user);
  }

  // Refresh Token
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        token: refreshToken,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Delete the used refresh token
    await this.refreshTokenRepository.remove(storedToken);

    // Get user based on type
    let user: Customer | ServiceProvider | Admin | null = null;
    let userId: string = storedToken.userId;

    switch (storedToken.userType) {
      case UserType.CUSTOMER:
        user = await this.customerRepository.findOne({
          where: { customerId: storedToken.userId },
        });
        break;
      case UserType.PROVIDER:
        user = await this.providerRepository.findOne({
          where: { providerId: storedToken.userId },
        });
        break;
      case UserType.ADMIN:
        user = await this.adminRepository.findOne({
          where: { id: storedToken.userId },
        });
        break;
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(userId, user.email, storedToken.userType, user);
  }

  // Logout
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenRepository.delete({ token: refreshToken });
  }

  // Forgot Password
  async forgotPassword(email: string, userType: UserTypeDto): Promise<void> {
    let user: Customer | ServiceProvider | Admin | null = null;
    let userId: string;
    let userName: string;

    switch (userType) {
      case UserTypeDto.CUSTOMER:
        user = await this.customerRepository.findOne({ where: { email } });
        if (user) {
          userId = user.customerId;
          userName = user.name;
        }
        break;
      case UserTypeDto.PROVIDER:
        user = await this.providerRepository.findOne({ where: { email } });
        if (user) {
          userId = user.providerId;
          userName = user.providerName;
        }
        break;
      case UserTypeDto.ADMIN:
        user = await this.adminRepository.findOne({ where: { email } });
        if (user) {
          userId = user.id;
          userName = user.name;
        }
        break;
    }

    if (!user) {
      // Don't reveal if user exists or not
      return;
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.jwtService.sign(
      { sub: userId!, email, userType },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '1h',
      },
    );

    // Send reset email
    await this.mailService.sendPasswordResetEmail(email, userName!, resetToken);
  }

  // Reset Password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      const passwordHash = await bcrypt.hash(newPassword, 10);

      switch (payload.userType) {
        case 'customer':
          await this.customerRepository.update(
            { customerId: payload.sub },
            { passwordHash },
          );
          break;
        case 'provider':
          await this.providerRepository.update(
            { providerId: payload.sub },
            { passwordHash },
          );
          break;
        case 'admin':
          await this.adminRepository.update(
            { id: payload.sub },
            { passwordHash },
          );
          break;
        default:
          throw new BadRequestException('Invalid user type');
      }
    } catch (error) {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  // Helper: Generate Access and Refresh Tokens
  private async generateTokens(
    userId: string,
    email: string,
    userType: UserType | string,
    user: any,
  ): Promise<AuthResponseDto> {
    const payload = { sub: userId, email, userType };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Store refresh token
    const tokenEntity = this.refreshTokenRepository.create({
      userId,
      userType: userType as UserType,
      token: refreshToken,
      expiresAt,
    });
    await this.refreshTokenRepository.save(tokenEntity);

    // Remove password from user object
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
      userType: userType.toString(),
    };
  }
}
