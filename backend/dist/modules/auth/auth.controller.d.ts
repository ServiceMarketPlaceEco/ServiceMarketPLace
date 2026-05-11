import { AuthService } from './auth.service';
import { RegisterCustomerDto, RegisterProviderDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, AuthResponseDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    registerCustomer(dto: RegisterCustomerDto): Promise<AuthResponseDto>;
    registerProvider(dto: RegisterProviderDto): Promise<AuthResponseDto>;
    login(dto: LoginDto): Promise<AuthResponseDto>;
    refreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto>;
    logout(dto: RefreshTokenDto): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
}
