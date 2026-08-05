export declare class CreateServiceDto {
    serviceName: string;
    description?: string;
    icon?: string;
}
declare const UpdateServiceDto_base: any;
export declare class UpdateServiceDto extends UpdateServiceDto_base {
    isActive?: boolean;
}
export declare class ServiceResponseDto {
    serviceId: string;
    serviceName: string;
    description: string;
    icon: string;
    isActive: boolean;
    createdAt: Date;
}
export {};
