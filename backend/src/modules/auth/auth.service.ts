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
import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Admin } from '../admins/entities/admin.entity';
import { RefreshToken, UserType } from './entities/refresh-token.entity';
import { PhoneVerification } from './entities/phone-verification.entity';
import {
  RegisterCustomerDto,
  RegisterProviderDto,
  LoginDto,
  UserTypeDto,
  AuthResponseDto,
} from './dto';
import { MailService } from '../mail/mail.service';

const PHONE_VERIFICATION_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  // Verifies Google ID tokens against Google's public signing keys.
  googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PhoneVerification)
    private phoneVerificationRepository: Repository<PhoneVerification>,
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

    const existingUsername = await this.customerRepository.findOne({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    if (dto.phoneVerificationToken) {
      await this.consumePhoneVerification(dto.phone, dto.phoneVerificationToken);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const customer = this.customerRepository.create({
      name: dto.name,
      username: dto.username,
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

    const existingUsername = await this.providerRepository.findOne({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const provider = this.providerRepository.create({
      providerName: dto.providerName,
      username: dto.username,
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

  // Sends (for now: generates and logs/returns, since no SMS provider is
  // configured yet) a 6-digit code for a phone number, ahead of customer
  // signup. Swapping in a real SMS provider later only touches this method.
  //
  // username/email are optional and, when passed, are checked for conflicts
  // up front - so a taken username or email fails before the SMS round trip
  // instead of after the customer has already typed in the code.
  async requestPhoneVerification(
    phone: string,
    username?: string,
    email?: string,
  ): Promise<{ verificationId: string; devCode?: string }> {
    if (email) {
      const existingEmail = await this.customerRepository.findOne({ where: { email } });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    if (username) {
      const existingUsername = await this.customerRepository.findOne({ where: { username } });
      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + PHONE_VERIFICATION_TTL_MS);

    const verification = this.phoneVerificationRepository.create({
      phone,
      codeHash,
      expiresAt,
    });
    await this.phoneVerificationRepository.save(verification);

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    // eslint-disable-next-line no-console
    console.log(`[phone-verification] code for ${phone}: ${code}`);

    return {
      verificationId: verification.id,
      ...(isProduction ? {} : { devCode: code }),
    };
  }

  // Confirms a code sent by requestPhoneVerification and issues a short-lived
  // token that registerCustomer accepts as proof the phone was verified.
  async verifyPhoneCode(verificationId: string, phone: string, code: string): Promise<{ verificationToken: string }> {
    const verification = await this.phoneVerificationRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification || verification.phone !== phone || verification.isConsumed) {
      throw new BadRequestException('Invalid verification request');
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('This verification code has expired. Please request a new one.');
    }

    const isCodeValid = await bcrypt.compare(code, verification.codeHash);
    if (!isCodeValid) {
      throw new BadRequestException('Incorrect verification code');
    }

    verification.isVerified = true;
    verification.verificationToken = uuidv4();
    await this.phoneVerificationRepository.save(verification);

    return { verificationToken: verification.verificationToken };
  }

  // Helper: validates and one-time-consumes a phoneVerificationToken passed
  // to registerCustomer, so the same verified code can't back two accounts.
  private async consumePhoneVerification(phone: string | undefined, token: string): Promise<void> {
    const verification = await this.phoneVerificationRepository.findOne({
      where: { verificationToken: token },
    });

    if (
      !verification ||
      verification.phone !== phone ||
      !verification.isVerified ||
      verification.isConsumed ||
      verification.expiresAt < new Date()
    ) {
      throw new BadRequestException('Phone verification is invalid or has expired. Please verify your phone number again.');
    }

    verification.isConsumed = true;
    await this.phoneVerificationRepository.save(verification);
  }

  // Login
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    let user: Customer | ServiceProvider | Admin | null = null;
    let userId: string;
    let userType: UserType;

    // When the caller doesn't know which account type this identifier belongs
    // to (e.g. a single sign-in form), look it up the same way
    // loginWithGoogle() does: customer, then provider, then admin.
    const resolvedType = dto.userType ?? (await this.resolveUserTypeByIdentifier(dto.identifier));

    if (!resolvedType) {
      throw new UnauthorizedException('Invalid credentials');
    }

    switch (resolvedType) {
      case UserTypeDto.CUSTOMER:
        user = await this.customerRepository.findOne({
          where: this.customerIdentifierWhere(dto.identifier),
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
          where: this.providerIdentifierWhere(dto.identifier),
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
          // providers cant sign in until an admin approves their application.
          // before this they could sign in straight away (M7 in the qa report)
          if (!(user as ServiceProvider).isVerified) {
            throw new UnauthorizedException('Your provider application is still waiting for admin approval');
          }
        }
        break;

      case UserTypeDto.ADMIN:
        user = await this.adminRepository.findOne({
          where: { email: dto.identifier },
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

  // Builds a TypeORM "OR" where clause matching a sign-in identifier against
  // email, username or phone. Customer phone is stored as a string; provider
  // phone is numeric, so a non-numeric identifier can't match it.
  private customerIdentifierWhere(identifier: string) {
    return [{ email: identifier }, { username: identifier }, { phone: identifier }];
  }

  private providerIdentifierWhere(identifier: string) {
    const where: Record<string, string | number>[] = [{ email: identifier }, { username: identifier }];
    if (/^\d+$/.test(identifier)) {
      where.push({ phone: Number(identifier) });
    }
    return where;
  }

  // Finds which account type (if any) a sign-in identifier (username, phone
  // or email) belongs to, by checking each table in turn. Used when the
  // caller doesn't already know the type.
  private async resolveUserTypeByIdentifier(identifier: string): Promise<UserTypeDto | undefined> {
    const customer = await this.customerRepository.findOne({
      where: this.customerIdentifierWhere(identifier),
      select: ['customerId'],
    });
    if (customer) return UserTypeDto.CUSTOMER;

    const provider = await this.providerRepository.findOne({
      where: this.providerIdentifierWhere(identifier),
      select: ['providerId'],
    });
    if (provider) return UserTypeDto.PROVIDER;

    const admin = await this.adminRepository.findOne({
      where: { email: identifier },
      select: ['id'],
    });
    if (admin) return UserTypeDto.ADMIN;

    return undefined;
  }

  // Login with Google: the Google account's email must belong to an account
  // that has already signed up. Google sign-in never creates new accounts.
  async loginWithGoogle(credential: string): Promise<AuthResponseDto> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Your Google email address is not verified');
    }

    const email = payload.email;

    const customer = await this.customerRepository.findOne({ where: { email } });
    if (customer) {
      this.assertCanSignIn(customer);
      return this.generateTokens(customer.customerId, customer.email, UserType.CUSTOMER, customer);
    }

    const provider = await this.providerRepository.findOne({ where: { email } });
    if (provider) {
      this.assertCanSignIn(provider);
      // same approval rule as the password sign in
      if (!provider.isVerified) {
        throw new UnauthorizedException('Your provider application is still waiting for admin approval');
      }
      return this.generateTokens(provider.providerId, provider.email, UserType.PROVIDER, provider);
    }

    const admin = await this.adminRepository.findOne({ where: { email } });
    if (admin) {
      this.assertCanSignIn(admin);
      return this.generateTokens(admin.id, admin.email, UserType.ADMIN, admin);
    }

    throw new NotFoundException(
      'This user has not been signed up. Please create an account first.',
    );
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

  // Helper: same blocked/inactive checks the password login applies
  private assertCanSignIn(user: { isActive: boolean; isBlocked?: boolean }): void {
    if (user.isBlocked) {
      throw new UnauthorizedException('Your account has been blocked');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Your account is not active');
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
