// unit tests for the fake review detector
//
// each signal gets tested in isolation (does it fire when it should) plus a
// couple of "honest review stays unflagged" tests so we know the detector
// isnt just flagging everything. this is the evidence that the ai feature
// actually works, which matters for the qa write up.
//
// run with: npm test

import {
  scoreReview,
  scanReviews,
  textSimilarity,
  ScorableReview,
  DETECTION_CONFIG,
} from './fake-review-detector';

// a sensible, clearly-legit review we can tweak per test.
// account is old, booking completed, rating moderate, comment real.
function legitReview(overrides: Partial<ScorableReview> = {}): ScorableReview {
  const now = new Date('2026-08-01T12:00:00Z');
  return {
    reviewId: 'r-legit',
    customerId: 'cust-1',
    providerId: 'prov-1',
    rating: 4,
    comment: 'The plumber arrived on time and fixed the leak under my sink properly.',
    createdAt: now,
    customerCreatedAt: new Date('2026-01-01T12:00:00Z'), // 7 months old
    hasCompletedBookingWithProvider: true,
    ...overrides,
  };
}

describe('textSimilarity', () => {
  it('returns 1 for identical text', () => {
    expect(textSimilarity('great fast service', 'great fast service')).toBe(1);
  });

  it('is case and spacing insensitive', () => {
    expect(textSimilarity('Great  Service', 'great service')).toBe(1);
  });

  it('returns 0 for completely different text', () => {
    expect(textSimilarity('plumbing was excellent', 'terrible slow rude')).toBe(0);
  });

  it('returns something in between for partial overlap', () => {
    const score = textSimilarity('fast and friendly service', 'fast service')
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe('scoreReview - individual signals', () => {
  it('does NOT flag an honest, well-formed review', () => {
    const result = scoreReview(legitReview(), [legitReview()]);
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('flags a brand new account leaving a 5-star rating', () => {
    const review = legitReview({
      rating: 5,
      createdAt: new Date('2026-08-01T12:00:00Z'),
      customerCreatedAt: new Date('2026-07-31T12:00:00Z'), // 1 day old
    });
    const result = scoreReview(review, [review]);
    expect(result.reasons.some((r) => r.signal === 'NEW_ACCOUNT_EXTREME')).toBe(true);
  });

  it('does not fire the new-account signal for an old account', () => {
    const review = legitReview({ rating: 5 }); // account is 7 months old
    const result = scoreReview(review, [review]);
    expect(result.reasons.some((r) => r.signal === 'NEW_ACCOUNT_EXTREME')).toBe(false);
  });

  it('flags a review with no completed booking for that provider', () => {
    const review = legitReview({ hasCompletedBookingWithProvider: false });
    const result = scoreReview(review, [review]);
    expect(result.reasons.some((r) => r.signal === 'NO_BOOKING')).toBe(true);
  });

  it('flags a burst of reviews for the same provider in a short window', () => {
    const base = new Date('2026-08-01T12:00:00Z').getTime();
    // 3 reviews for prov-1 within a couple hours of each other
    const batch: ScorableReview[] = [0, 1, 2].map((i) =>
      legitReview({
        reviewId: `r-${i}`,
        customerId: `cust-${i}`,
        createdAt: new Date(base + i * 60 * 60 * 1000), // 1h apart
      }),
    );
    const result = scoreReview(batch[0], batch);
    expect(result.reasons.some((r) => r.signal === 'BURST')).toBe(true);
  });

  it('does not fire burst when reviews are spread far apart', () => {
    const base = new Date('2026-08-01T12:00:00Z').getTime();
    const batch: ScorableReview[] = [0, 1, 2].map((i) =>
      legitReview({
        reviewId: `r-${i}`,
        customerId: `cust-${i}`,
        createdAt: new Date(base + i * 5 * 24 * 60 * 60 * 1000), // 5 days apart
      }),
    );
    const result = scoreReview(batch[0], batch);
    expect(result.reasons.some((r) => r.signal === 'BURST')).toBe(false);
  });

  it('flags near-duplicate copy-pasted comments', () => {
    const shared = 'Amazing service very professional and quick highly recommend to everyone';
    const a = legitReview({ reviewId: 'r-a', customerId: 'cust-a', comment: shared });
    const b = legitReview({ reviewId: 'r-b', customerId: 'cust-b', comment: shared });
    const result = scoreReview(a, [a, b]);
    expect(result.reasons.some((r) => r.signal === 'DUPLICATE_TEXT')).toBe(true);
  });

  it('flags generic one-word filler like "good"', () => {
    const review = legitReview({ comment: 'good' });
    const result = scoreReview(review, [review]);
    expect(result.reasons.some((r) => r.signal === 'GENERIC_TEXT')).toBe(true);
  });

  it('flags a very short comment on an extreme rating', () => {
    const review = legitReview({ rating: 5, comment: 'yes!' });
    const result = scoreReview(review, [review]);
    expect(result.reasons.some((r) => r.signal === 'SHORT_TEXT')).toBe(true);
  });
});

describe('scoreReview - combining signals and threshold', () => {
  it('flags a review that trips several signals at once', () => {
    // brand new account + no booking + generic text = clearly fake
    const review = legitReview({
      rating: 5,
      comment: 'best',
      customerCreatedAt: new Date('2026-07-31T12:00:00Z'),
      hasCompletedBookingWithProvider: false,
    });
    const result = scoreReview(review, [review]);
    expect(result.flagged).toBe(true);
    // score should be the sum of the individual weights that fired
    const expected = result.reasons.reduce((sum, r) => sum + r.weight, 0);
    expect(result.score).toBe(expected);
  });

  it('a single weak signal on its own stays under the threshold', () => {
    // just generic text (weight 1) shouldnt be enough to flag by itself
    const review = legitReview({ comment: 'nice' });
    const result = scoreReview(review, [review]);
    expect(result.score).toBeLessThan(DETECTION_CONFIG.flagThreshold);
    expect(result.flagged).toBe(false);
  });
});

describe('scanReviews - the admin queue', () => {
  it('returns only flagged reviews, worst score first', () => {
    const base = new Date('2026-08-01T12:00:00Z').getTime();

    // one clearly fake, one mild, one honest
    const fake = legitReview({
      reviewId: 'r-fake',
      customerId: 'cust-fake',
      rating: 5,
      comment: 'best',
      customerCreatedAt: new Date('2026-07-31T12:00:00Z'),
      hasCompletedBookingWithProvider: false,
    });
    const honest = legitReview({ reviewId: 'r-honest', customerId: 'cust-honest' });

    const queue = scanReviews([fake, honest]);

    // honest one should not appear
    expect(queue.every((q) => q.reviewId !== 'r-honest')).toBe(true);
    // fake one should be in the queue
    expect(queue.some((q) => q.reviewId === 'r-fake')).toBe(true);
  });

  it('returns an empty queue when every review is legit', () => {
    // two genuinely different reviews - different wording, old accounts,
    // real bookings - so nothing should trip
    const queue = scanReviews([
      legitReview({
        reviewId: 'r-1',
        customerId: 'c-1',
        comment: 'The plumber arrived on time and fixed the leak under my sink properly.',
      }),
      legitReview({
        reviewId: 'r-2',
        customerId: 'c-2',
        createdAt: new Date('2026-07-01T12:00:00Z'),
        comment: 'Very tidy electrician, rewired the switchboard and cleaned up after himself.',
      }),
    ]);
    expect(queue).toEqual([]);
  });

  it('handles an empty review list without crashing', () => {
    expect(scanReviews([])).toEqual([]);
  });
});
