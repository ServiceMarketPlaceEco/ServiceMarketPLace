export declare enum UserTypeDto {
    CUSTOMER = "customer",
    PROVIDER = "provider",
    ADMIN = "admin"
}
export declare class RegisterCustomerDto {
    name: string;
    email: string;
    password: string;
    age?: number;
    phone?: string;
    address?: string;
}
export declare class RegisterProviderDto {
    providerName: string;
    email: string;
    password: string;
    abn?: number;
    address?: string;
    postalCode?: number;
    phone?: number;
    description?: string;
}
export declare class LoginDto {
    email: string;
    password: string;
    userType: UserTypeDto;
}
export declare class RefreshTokenDto {
    refreshToken: string;
}
export declare class ForgotPasswordDto {
    email: string;
    userType: UserTypeDto;
}
export declare class ResetPasswordDto {
    token: string;
    newPassword: string;
}
export declare class AuthResponseDto {
    accessToken: string;
    refreshToken: string;
    user: any;
    userType: string;
}
