// fake account / ingenuine profile detection - the scoring logic
//
// same rule-based, explainable approach as the review detector. we score an
// ACCOUNT (provider or customer) on suspicious signals and route anything over
// the threshold to the admin queue with plain-english reasons. the admin makes
// the final call - nothing is auto-blocked.
//
// the strongest signal is DUPLICATE IDENTITY: the same nid / phone / email /
// licence turning up on more than one account, which is one person running
// many. that catches the sock-puppet pattern where a dodgy provider spins up
// fake customer accounts to leave themselves 5-star reviews.

import { validateNid, validateTradeLicence } from './bd-identity';

// a scorable account. loose shape so it works for both providers and customers
// and with whatever id fields exist. everything optional except the id/kind.
export interface ScorableAccount {
  accountId: string;
  kind: 'provider' | 'customer';
  email?: string | null;
  phone?: string | number | null;
  createdAt?: Date;

  // provider-ish identity fields (optional - the entity may not have them yet)
  nid?: string | number | null;
  tradeLicence?: string | number | null;

  // behavioural context
  completedBookings?: number; // how many bookings this account completed
  reviewsWritten?: number; // how many reviews this account left
  distinctProvidersReviewed?: number; // how many different providers they reviewed
}

export interface AccountFlagReason {
  signal: string;
  detail: string;
  weight: number;
}

export interface AccountScore {
  accountId: string;
  kind: 'provider' | 'customer';
  score: number;
  flagged: boolean;
  reasons: AccountFlagReason[];
}

export const ACCOUNT_DETECTION_CONFIG = {
  flagThreshold: 3,
  weights: {
    invalidNid: 2,
    invalidLicence: 1,
    duplicateIdentity: 3, // same phone/email/nid/licence on another account
    sockPuppet: 2, // no bookings but only ever reviews one provider
    reviewsWithoutBooking: 2, // wrote reviews, never completed a booking
  },
};

// normalise a contact value for duplicate comparison (lowercase, digits only
// for phones). returns '' for empty so we never match two blanks together.
function normaliseContact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().replace(/\s+/g, '').trim();
}

// score ONE account against the whole batch (batch needed for duplicate check)
export function scoreAccount(
  account: ScorableAccount,
  batch: ScorableAccount[],
  config = ACCOUNT_DETECTION_CONFIG,
): AccountScore {
  const reasons: AccountFlagReason[] = [];
  const w = config.weights;

  // signal 1: invalid NID (only checked if the account actually has one)
  if (account.nid !== undefined && account.nid !== null && String(account.nid).trim() !== '') {
    const check = validateNid(account.nid);
    if (!check.valid) {
      reasons.push({ signal: 'INVALID_NID', detail: check.reason!, weight: w.invalidNid });
    }
  }

  // signal 2: invalid trade licence (providers only, if present)
  if (
    account.tradeLicence !== undefined &&
    account.tradeLicence !== null &&
    String(account.tradeLicence).trim() !== ''
  ) {
    const check = validateTradeLicence(account.tradeLicence);
    if (!check.valid) {
      reasons.push({ signal: 'INVALID_LICENCE', detail: check.reason!, weight: w.invalidLicence });
    }
  }

  // signal 3: duplicate identity - same phone/email/nid/licence on another
  // account. this is the one-person-many-accounts / sock-puppet signal.
  const myEmail = normaliseContact(account.email);
  const myPhone = normaliseContact(account.phone);
  const myNid = normaliseContact(account.nid);
  const myLicence = normaliseContact(account.tradeLicence);

  const duplicate = batch.find((other) => {
    if (other.accountId === account.accountId) return false;
    return (
      (myEmail && normaliseContact(other.email) === myEmail) ||
      (myPhone && normaliseContact(other.phone) === myPhone) ||
      (myNid && normaliseContact(other.nid) === myNid) ||
      (myLicence && normaliseContact(other.tradeLicence) === myLicence)
    );
  });
  if (duplicate) {
    reasons.push({
      signal: 'DUPLICATE_IDENTITY',
      detail: `Shares contact/ID details with account ${duplicate.accountId}`,
      weight: w.duplicateIdentity,
    });
  }

  // signal 4: sock puppet - a customer with no completed bookings who only
  // ever reviews ONE provider (classic self-review boosting)
  if (
    account.kind === 'customer' &&
    (account.completedBookings ?? 0) === 0 &&
    (account.reviewsWritten ?? 0) > 0 &&
    (account.distinctProvidersReviewed ?? 0) === 1
  ) {
    reasons.push({
      signal: 'SOCK_PUPPET',
      detail: 'No completed bookings but only reviews a single provider',
      weight: w.sockPuppet,
    });
  }

  // signal 5: wrote reviews but never actually completed a booking at all
  if (
    account.kind === 'customer' &&
    (account.completedBookings ?? 0) === 0 &&
    (account.reviewsWritten ?? 0) > 0 &&
    (account.distinctProvidersReviewed ?? 0) > 1
  ) {
    reasons.push({
      signal: 'REVIEWS_NO_BOOKING',
      detail: 'Left reviews without ever completing a booking',
      weight: w.reviewsWithoutBooking,
    });
  }

  const score = reasons.reduce((sum, r) => sum + r.weight, 0);

  return {
    accountId: account.accountId,
    kind: account.kind,
    score,
    flagged: score >= config.flagThreshold,
    reasons,
  };
}

// scan a whole batch, return only flagged accounts worst-first (the admin queue)
export function scanAccounts(
  accounts: ScorableAccount[],
  config = ACCOUNT_DETECTION_CONFIG,
): AccountScore[] {
  return accounts
    .map((a) => scoreAccount(a, accounts, config))
    .filter((r) => r.flagged)
    .sort((a, b) => b.score - a.score);
}
