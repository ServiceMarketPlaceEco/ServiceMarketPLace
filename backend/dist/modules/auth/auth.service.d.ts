import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { ServiceProvider } from '../providers/entities/service-provider.entity';
import { Admin } from '../admins/entities/admin.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterCustomerDto, RegisterProviderDto, LoginDto, UserTypeDto, AuthResponseDto } from './dto';
import { MailService } from '../mail/mail.service';
export declare class AuthService {
    private customerRepository;
    private providerRepository;
    private adminRepository;
    private refreshTokenRepository;
    private jwtService;
    private configService;
    private mailService;
    constructor(customerRepository: Repository<Customer>, providerRepository: Repository<ServiceProvider>, adminRepository: Repository<Admin>, refreshTokenRepository: Repository<RefreshToken>, jwtService: JwtService, configService: ConfigService, mailService: MailService);
    registerCustomer(dto: RegisterCustomerDto): Promise<AuthResponseDto>;
    registerProvider(dto: RegisterProviderDto): Promise<AuthResponseDto>;
    login(dto: LoginDto): Promise<AuthResponseDto>;
    refreshToken(refreshToken: string): Promise<AuthResponseDto>;
    logout(refreshToken: string): Promise<void>;
    forgotPassword(email: string, userType: UserTypeDto): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    private generateTokens;
}
