export interface CurrentUserData {
    userId: string;
    email: string;
    userType: 'customer' | 'provider' | 'admin';
    user: any;
}
export declare const CurrentUser: (...dataOrPipes: (keyof CurrentUserData | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
