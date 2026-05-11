export declare class UpdateCustomerProfileDto {
    name?: string;
    age?: number;
    phone?: string;
    address?: string;
    profileImage?: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class CustomerResponseDto {
    customerId: string;
    name: string;
    email: string;
    age: number;
    phone: string;
    address: string;
    profileImage: string;
    isActive: boolean;
    createdAt: Date;
}
