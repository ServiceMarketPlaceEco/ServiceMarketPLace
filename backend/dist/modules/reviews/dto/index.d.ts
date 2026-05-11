export declare class CreateReviewDto {
    bookingId: string;
    rating: number;
    comment?: string;
}
export declare class UpdateReviewDto {
    rating?: number;
    comment?: string;
}
export declare class ReviewResponseDto {
    reviewId: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    rating: number;
    comment: string;
    createdAt: Date;
    customer?: {
        name: string;
        profileImage: string;
    };
}
