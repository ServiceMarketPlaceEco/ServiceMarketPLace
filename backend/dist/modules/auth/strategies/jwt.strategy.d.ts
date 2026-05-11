import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private configService;
    private customerRepository;
    private providerRepository;
    private adminRepository;
    constructor(configService: ConfigService, customerRepository: Repository<Customer>, providerRepository: Repository<ServiceProvider>, adminRepository: Repository<Admin>);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        email: string;
        userType: "customer" | "provider" | "admin";
        user: Customer | ServiceProvider | Admin;
    }>;
}
export {};
