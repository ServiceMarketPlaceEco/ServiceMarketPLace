export declare enum UserType {
    CUSTOMER = "customer",
    PROVIDER = "provider",
    ADMIN = "admin"
}
export declare class RefreshToken {
    id: string;
    userId: string;
    userType: UserType;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}
