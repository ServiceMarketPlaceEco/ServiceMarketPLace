import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { ServiceProvider } from '../../providers/entities/service-provider.entity';
import { Admin } from '../../admins/entities/admin.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  userType: 'customer' | 'provider' | 'admin';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private providerRepository: Repository<ServiceProvider>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    let user: Customer | ServiceProvider | Admin | null = null;

    switch (payload.userType) {
      case 'customer':
        user = await this.customerRepository.findOne({
          where: { customerId: payload.sub },
        });
        if (!user || !user.isActive || user.isBlocked) {
          throw new UnauthorizedException('User account is not active');
        }
        break;
      case 'provider':
        user = await this.providerRepository.findOne({
          where: { providerId: payload.sub },
        });
        if (!user || !user.isActive || user.isBlocked) {
          throw new UnauthorizedException('Provider account is not active');
        }
        break;
      case 'admin':
        user = await this.adminRepository.findOne({
          where: { id: payload.sub },
        });
        if (!user || !user.isActive) {
          throw new UnauthorizedException('Admin account is not active');
        }
        break;
      default:
        throw new UnauthorizedException('Invalid user type');
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType,
      user,
    };
  }
}
