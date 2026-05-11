export declare enum AdminRole {
    SUPER_ADMIN = "super_admin",
    ADMIN = "admin",
    MODERATOR = "moderator"
}
export declare class Admin {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: AdminRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
