// unit tests for the rule based transcript matcher
//
// the catalog below is the real rajshahi seed (002_rajshahi_services_seed.sql)
// so these tests describe what customers will actually experience.
//
// run with: npm test

import { editDistance, matchTranscript, MatchableService, stem } from './transcript-matcher';

const CATALOG: MatchableService[] = [
  { serviceId: 'cleaning', serviceName: 'Home Cleaning', description: 'General cleaning, kitchen cleaning and household support in Rajshahi.' },
  { serviceId: 'moving', serviceName: 'Moving Help', description: 'Packing, lifting, small shifting and local moving support.' },
  { serviceId: 'delivery', serviceName: 'Local Delivery', description: 'Parcel, medicine, document and food delivery around Rajshahi.' },
  { serviceId: 'tech', serviceName: 'Tech Support', description: 'Laptop, WiFi, mobile setup and basic software support.' },
  { serviceId: 'ac', serviceName: 'AC Repair', description: 'AC servicing, cooling issue checks and installation help.' },
  { serviceId: 'electric', serviceName: 'Electrician', description: 'Fan, switch, light, socket and wiring support.' },
  { serviceId: 'plumbing', serviceName: 'Plumbing Help', description: 'Tap leaks, pipe issues, bathroom fittings and drainage help.' },
  { serviceId: 'tutoring', serviceName: 'Home Tutoring', description: 'Local academic support for school and college students.' },
  { serviceId: 'care', serviceName: 'Elder Care Visit', description: 'Basic home visit support, errands and check-in assistance.' },
];

function topMatch(transcript: string) {
  return matchTranscript(transcript, CATALOG)[0]?.serviceId;
}

describe('helpers', () => {
  it('stems common english endings', () => {
    expect(stem('leaking')).toBe(stem('leaks'));
    expect(stem('leak')).toBe('leak');
  });

  it('computes edit distance', () => {
    expect(editDistance('plumer', 'plumber')).toBe(1);
    expect(editDistance('electrition', 'electrician')).toBe(2);
    expect(editDistance('same', 'same')).toBe(0);
  });
});

describe('matchTranscript - natural english requests with no service keyword', () => {
  it.each([
    ['my aircon stopped blowing cold air', 'ac'],
    ['the kitchen tap is leaking everywhere', 'plumbing'],
    ['the ceiling fan and some sockets have no power', 'electric'],
    ['my son needs help with maths homework before his exam', 'tutoring'],
    ['can someone check on my grandmother while I am away', 'care'],
    ['I need to send a parcel across town', 'delivery'],
    ['our wifi router keeps dropping', 'tech'],
    ['we are shifting to a new flat and need packing', 'moving'],
    ['the house is really dusty, please mop and sweep', 'cleaning'],
  ])('"%s" -> %s', (transcript, expected) => {
    expect(topMatch(transcript)).toBe(expected);
  });
});

describe('matchTranscript - bengali requests', () => {
  it.each([
    ['আমার বাসার এসি মেরামত করতে হবে', 'ac'],
    ['বাথরুমের কল দিয়ে পানি পড়ছে', 'plumbing'],
    ['ঘর পরিষ্কার করতে হবে', 'cleaning'],
    ['ছেলের জন্য একজন টিউটর দরকার', 'tutoring'],
    ['ফ্যান কাজ করছে না, ইলেকট্রিশিয়ান দরকার', 'electric'],
  ])('"%s" -> %s', (transcript, expected) => {
    expect(topMatch(transcript)).toBe(expected);
  });
});

describe('matchTranscript - speech recognition mistakes', () => {
  it('forgives small typos in longer words', () => {
    expect(topMatch('I need a plumer')).toBe('plumbing');
    expect(topMatch('looking for an electrition')).toBe('electric');
  });

  it('does not fuzzy match short everyday words ("right" is not "light")', () => {
    expect(matchTranscript('right', CATALOG)).toEqual([]);
  });
});

describe('matchTranscript - result shape', () => {
  it('returns nothing for unrelated chatter', () => {
    expect(matchTranscript('hello how are you', CATALOG)).toEqual([]);
    expect(matchTranscript('', CATALOG)).toEqual([]);
  });

  it('gives a reason and a 0..1 confidence for each match', () => {
    const [best] = matchTranscript('my air conditioner is not cooling', CATALOG);
    expect(best.serviceId).toBe('ac');
    expect(best.confidence).toBeGreaterThan(0);
    expect(best.confidence).toBeLessThanOrEqual(1);
    expect(best.reason).toMatch(/air conditioning/);
  });

  it('ranks best first and caps the list', () => {
    const results = matchTranscript('home help support', CATALOG);
    expect(results.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});
