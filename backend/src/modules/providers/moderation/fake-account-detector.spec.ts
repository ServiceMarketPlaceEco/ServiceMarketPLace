

import { validateNid, validateTradeLicence } from './bd-identity';
import {
  scoreAccount,
  scanAccounts,
  ScorableAccount,
  ACCOUNT_DETECTION_CONFIG,
} from './fake-account-detector';

describe('validateNid', () => {
  it('accepts a valid 10-digit Smart NID', () => {
    expect(validateNid('1234567890').valid).toBe(true);
  });

  it('accepts a valid 13-digit NID', () => {
    expect(validateNid('1234567890123').valid).toBe(true);
  });

  it('accepts a valid 17-digit NID with a plausible birth year', () => {
    // starts with 1990 = birth year, then 13 more digits
    expect(validateNid('19901234567890123').valid).toBe(true);
  });

  it('rejects a NID with the wrong number of digits', () => {
    const check = validateNid('12345');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('expected 10, 13 or 17');
  });

  it('rejects a NID with letters in it', () => {
    expect(validateNid('12345ABC90').valid).toBe(false);
  });

  it('rejects a NID that is all the same digit', () => {
    expect(validateNid('1111111111').valid).toBe(false);
  });

  it('rejects a 17-digit NID with an impossible birth year', () => {
    // starts with 0230 - not a real year
    const check = validateNid('02301234567890123');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('birth year');
  });

  it('rejects a missing NID', () => {
    expect(validateNid(null).valid).toBe(false);
    expect(validateNid(undefined).valid).toBe(false);
  });
});

describe('validateTradeLicence', () => {
  it('accepts a normal licence number', () => {
    expect(validateTradeLicence('02028470').valid).toBe(true);
  });

  it('accepts a licence with letters (some authorities use them)', () => {
    expect(validateTradeLicence('TL-2024-0091').valid).toBe(true);
  });

  it('rejects an empty licence', () => {
    expect(validateTradeLicence('').valid).toBe(false);
    expect(validateTradeLicence(null).valid).toBe(false);
  });

  it('rejects a licence that is all the same character', () => {
    expect(validateTradeLicence('0000000').valid).toBe(false);
  });

  it('rejects a licence with weird symbols', () => {
    expect(validateTradeLicence('12@#$%').valid).toBe(false);
  });
});

// a clearly-genuine account we tweak per test
function legitAccount(overrides: Partial<ScorableAccount> = {}): ScorableAccount {
  return {
    accountId: 'acc-1',
    kind: 'customer',
    email: 'real.person@example.com',
    phone: '01712345678',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    completedBookings: 3,
    reviewsWritten: 2,
    distinctProvidersReviewed: 2,
    ...overrides,
  };
}

describe('scoreAccount - individual signals', () => {
  it('does not flag a genuine account', () => {
    const result = scoreAccount(legitAccount(), [legitAccount()]);
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('flags a provider with an invalid NID', () => {
    const acc = legitAccount({ kind: 'provider', nid: '12345' }); // too short
    const result = scoreAccount(acc, [acc]);
    expect(result.reasons.some((r) => r.signal === 'INVALID_NID')).toBe(true);
  });

  it('does not check NID when the account has none', () => {
    const acc = legitAccount({ nid: null });
    const result = scoreAccount(acc, [acc]);
    expect(result.reasons.some((r) => r.signal === 'INVALID_NID')).toBe(false);
  });

  it('flags two accounts sharing the same phone number', () => {
    const a = legitAccount({ accountId: 'a', phone: '01700000000' });
    const b = legitAccount({ accountId: 'b', email: 'different@example.com', phone: '01700000000' });
    const result = scoreAccount(a, [a, b]);
    expect(result.reasons.some((r) => r.signal === 'DUPLICATE_IDENTITY')).toBe(true);
  });

  it('flags accounts sharing the same email', () => {
    const a = legitAccount({ accountId: 'a', email: 'same@example.com', phone: '01711111111' });
    const b = legitAccount({ accountId: 'b', email: 'same@example.com', phone: '01722222222' });
    const result = scoreAccount(a, [a, b]);
    expect(result.reasons.some((r) => r.signal === 'DUPLICATE_IDENTITY')).toBe(true);
  });

  it('flags a sock-puppet customer (no bookings, reviews one provider)', () => {
    const acc = legitAccount({
      completedBookings: 0,
      reviewsWritten: 3,
      distinctProvidersReviewed: 1,
    });
    const result = scoreAccount(acc, [acc]);
    expect(result.reasons.some((r) => r.signal === 'SOCK_PUPPET')).toBe(true);
  });

  it('flags a customer who reviewed without ever booking', () => {
    const acc = legitAccount({
      completedBookings: 0,
      reviewsWritten: 4,
      distinctProvidersReviewed: 3,
    });
    const result = scoreAccount(acc, [acc]);
    expect(result.reasons.some((r) => r.signal === 'REVIEWS_NO_BOOKING')).toBe(true);
  });
});

describe('scoreAccount - threshold', () => {
  it('flags an account that trips several signals', () => {
    // invalid nid + duplicate phone = over threshold
    const a = legitAccount({ accountId: 'a', kind: 'provider', nid: '12345', phone: '01700000000' });
    const b = legitAccount({ accountId: 'b', phone: '01700000000' });
    const result = scoreAccount(a, [a, b]);
    expect(result.flagged).toBe(true);
  });

  it('a single weak signal stays under the threshold', () => {
    // just an invalid licence (weight 1) shouldnt flag on its own
    const acc = legitAccount({ kind: 'provider', tradeLicence: '11111' });
    const result = scoreAccount(acc, [acc]);
    expect(result.score).toBeLessThan(ACCOUNT_DETECTION_CONFIG.flagThreshold);
    expect(result.flagged).toBe(false);
  });
});

describe('scanAccounts - the admin queue', () => {
  it('returns only flagged accounts, worst first', () => {
    const sockPuppet = legitAccount({
      accountId: 'puppet',
      completedBookings: 0,
      reviewsWritten: 3,
      distinctProvidersReviewed: 1,
      phone: '01700000000',
    });
    const duplicate = legitAccount({
      accountId: 'dup',
      email: 'x@example.com',
      phone: '01700000000', // shares phone with sockPuppet -> both get duplicate flag
    });
    const honest = legitAccount({ accountId: 'honest', email: 'h@example.com', phone: '01799999999' });

    const queue = scanAccounts([sockPuppet, duplicate, honest]);

    expect(queue.every((q) => q.accountId !== 'honest')).toBe(true);
    expect(queue.some((q) => q.accountId === 'puppet')).toBe(true);
    // sorted worst first
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i - 1].score).toBeGreaterThanOrEqual(queue[i].score);
    }
  });

  it('returns an empty queue when all accounts are genuine', () => {
    const queue = scanAccounts([
      legitAccount({ accountId: 'a', email: 'a@x.com', phone: '01700000001' }),
      legitAccount({ accountId: 'b', email: 'b@x.com', phone: '01700000002' }),
    ]);
    expect(queue).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(scanAccounts([])).toEqual([]);
  });
});
