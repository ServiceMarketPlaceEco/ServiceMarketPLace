export interface CurrentUserData {
    userId: string;
    email: string;
    userType: 'customer' | 'provider' | 'admin';
    user: any;
}
export declare const CurrentUser: any;
