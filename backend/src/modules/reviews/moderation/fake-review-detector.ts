// fake review detection - the actual scoring logic
//
// this is deliberately RULE BASED, not machine learning. every flag has a
// plain english reason, so when a review lands in the admin queue the admin
// can see exactly WHY it was flagged and make the final call. the ai assists,
// the human decides, nothing is auto deleted.
//
// ml could come later as a phase 2, but rules are transparent, need no
// training data, and are easy to test - which is the point for now.

// the shape of a review we score. kept loose on purpose so it works with
// the real Review entity or a plain test object.
export interface ScorableReview {
  reviewId: string;
  customerId: string;
  providerId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  // when the customer account itself was created, used for the
  // "brand new account" signal. optional because we might not always join it.
  customerCreatedAt?: Date;
  // whether this customer has a completed booking with this provider.
  // optional, when its explicitly false we treat it as a signal.
  hasCompletedBookingWithProvider?: boolean;
}

// one reason a review looked suspicious
export interface FlagReason {
  signal: string; // short code, e.g. 'BURST'
  detail: string; // human readable explanation for the admin
  weight: number; // how much this adds to the score
}

// the result for a single review after scoring
export interface ReviewScore {
  reviewId: string;
  score: number;
  flagged: boolean;
  reasons: FlagReason[];
}

// all the tuning knobs live here so theyre easy to find and adjust.
// nothing magic is buried in the code below.
export const DETECTION_CONFIG = {
  // a review at or above this total score gets flagged for the admin
  flagThreshold: 3,

  // account younger than this many days counts as "brand new"
  newAccountDays: 3,

  // this many reviews for one provider inside the burst window = a burst
  burstCount: 3,
  burstWindowHours: 24,

  // comments shorter than this (after trimming) count as low effort
  minCommentLength: 8,

  // generic one word praise that shows up in spammy reviews
  genericPhrases: ['good', 'nice', 'best', 'ok', 'great', 'super', 'wow', 'fine'],

  // how similar two comments must be (0..1) to count as near duplicate
  duplicateSimilarity: 0.9,

  // weights - how many points each signal adds
  weights: {
    newAccountExtremeRating: 2,
    noCompletedBooking: 2,
    burst: 2,
    duplicateText: 3,
    genericText: 1,
    veryShortText: 1,
  },
};

// tiny helper - normalise a comment for comparison (lowercase, collapse spaces)
function normalise(text: string): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// similarity between two strings, 0 = nothing shared, 1 = identical.
// uses word overlap (Jaccard) - simple, no dependencies, good enough to catch
// copy pasted reviews without pulling in a whole nlp library.
export function textSimilarity(a: string, b: string): number {
  const listA = normalise(a).split(' ').filter(Boolean);
  const listB = normalise(b).split(' ').filter(Boolean);
  const wordsA = Array.from(new Set(listA));
  const wordsB = Array.from(new Set(listB));
  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  const union = new Set(wordsA.concat(wordsB)).size;
  return shared / union;
}

// age of an account in days at the time the review was left
function accountAgeDays(reviewCreated: Date, accountCreated?: Date): number | null {
  if (!accountCreated) return null;
  const ms = reviewCreated.getTime() - accountCreated.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// score ONE review against the whole batch its part of. the batch is needed
// for the signals that only make sense in context (bursts, duplicates).
export function scoreReview(
  review: ScorableReview,
  batch: ScorableReview[],
  config = DETECTION_CONFIG,
): ReviewScore {
  const reasons: FlagReason[] = [];
  const w = config.weights;
  const comment = review.comment || '';
  const trimmed = comment.trim();

  // signal 1: brand new account leaving a 5 or 1 star (the extremes people fake)
  const age = accountAgeDays(review.createdAt, review.customerCreatedAt);
  const isExtreme = review.rating >= 5 || review.rating <= 1;
  if (age !== null && age <= config.newAccountDays && isExtreme) {
    reasons.push({
      signal: 'NEW_ACCOUNT_EXTREME',
      detail: `Account was ${age.toFixed(1)} days old and left a ${review.rating}-star rating`,
      weight: w.newAccountExtremeRating,
    });
  }

  // signal 2: reviewing a provider you never completed a booking with
  if (review.hasCompletedBookingWithProvider === false) {
    reasons.push({
      signal: 'NO_BOOKING',
      detail: 'No completed booking found between this customer and provider',
      weight: w.noCompletedBooking,
    });
  }

  // signal 3: burst - lots of reviews for the same provider in a short window
  const windowMs = config.burstWindowHours * 60 * 60 * 1000;
  const sameProviderNearby = batch.filter(
    (r) =>
      r.providerId === review.providerId &&
      Math.abs(r.createdAt.getTime() - review.createdAt.getTime()) <= windowMs,
  );
  if (sameProviderNearby.length >= config.burstCount) {
    reasons.push({
      signal: 'BURST',
      detail: `${sameProviderNearby.length} reviews for this provider within ${config.burstWindowHours}h`,
      weight: w.burst,
    });
  }

  // signal 4: near duplicate text - same comment copy pasted across reviews
  if (trimmed.length > 0) {
    const duplicateOf = batch.find(
      (r) =>
        r.reviewId !== review.reviewId &&
        (r.comment || '').trim().length > 0 &&
        textSimilarity(comment, r.comment || '') >= config.duplicateSimilarity,
    );
    if (duplicateOf) {
      reasons.push({
        signal: 'DUPLICATE_TEXT',
        detail: `Comment is nearly identical to review ${duplicateOf.reviewId}`,
        weight: w.duplicateText,
      });
    }
  }

  // signal 5: generic one word praise ("good", "best" etc)
  if (config.genericPhrases.includes(normalise(comment))) {
    reasons.push({
      signal: 'GENERIC_TEXT',
      detail: `Comment is generic filler ("${trimmed}")`,
      weight: w.genericText,
    });
  }

  // signal 6: very short / empty comment on an extreme rating
  if (isExtreme && trimmed.length > 0 && trimmed.length < config.minCommentLength) {
    reasons.push({
      signal: 'SHORT_TEXT',
      detail: `Very short comment (${trimmed.length} chars) on an extreme rating`,
      weight: w.veryShortText,
    });
  }

  const score = reasons.reduce((sum, r) => sum + r.weight, 0);

  return {
    reviewId: review.reviewId,
    score,
    flagged: score >= config.flagThreshold,
    reasons,
  };
}

// score a whole batch and return only what the admin queue cares about:
// the flagged ones, worst first.
export function scanReviews(
  reviews: ScorableReview[],
  config = DETECTION_CONFIG,
): ReviewScore[] {
  return reviews
    .map((r) => scoreReview(r, reviews, config))
    .filter((result) => result.flagged)
    .sort((a, b) => b.score - a.score);
}
