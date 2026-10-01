// transcript -> service matching, the RULE BASED half
//
// the browser's voice-to-text gives us whatever the customer said, e.g.
// "my aircon stopped blowing cold air" or "আমার বাসার কল দিয়ে পানি পড়ছে".
// plain keyword search misses both because neither sentence contains a
// service title. this matcher understands what the customer is asking for
// by mapping what they said onto "concepts" (cooling, leaks, wiring...)
// and checking which catalog services cover those concepts.
//
// the AI ranker in service-matching.service.ts is tried first when an
// OPENAI_API_KEY is set. this file is the fallback: no network, no key,
// fully testable, and every match comes with a plain english reason.

// the shape of a catalog service we can score. kept loose so it works with
// the Service entity or a plain test object.
export interface MatchableService {
  serviceId: string;
  serviceName: string;
  description?: string | null;
}

export interface ServiceMatch {
  serviceId: string;
  serviceName: string;
  confidence: number; // 0..1
  reason: string;
}

// a concept is "a thing a customer might need". `terms` are what customers
// say (english words/phrases are matched as whole words, bengali is matched
// as a substring because bengali words carry suffixes like বাসা -> বাসার).
// a service covers a concept when its name/description mentions any english
// term of that concept.
interface Concept {
  name: string;
  terms: string[];
  // generic concepts ("repair", "home") help break ties but should never
  // outrank a specific one on their own
  weak?: boolean;
}

export const CONCEPTS: Concept[] = [
  {
    name: 'cleaning',
    terms: [
      'clean', 'cleaning', 'cleaner', 'dust', 'dusty', 'dirty', 'mop', 'sweep',
      'tidy', 'housekeeping', 'maid', 'deep clean', 'kitchen cleaning',
      'পরিষ্কার', 'পরিচ্ছন্ন', 'ক্লিনিং', 'ঝাড়ু', 'ময়লা', 'নোংরা',
    ],
  },
  {
    name: 'air conditioning',
    terms: [
      'ac', 'aircon', 'air con', 'air conditioner', 'air conditioning', 'cooling',
      'cold air', 'hvac', 'heating', 'ventilation', 'thermostat', 'not cooling',
      'এসি', 'এয়ার কন্ডিশনার', 'ঠান্ডা',
    ],
  },
  {
    name: 'plumbing',
    terms: [
      'plumber', 'plumbing', 'leak', 'leaking', 'leaky', 'pipe', 'tap', 'faucet',
      'drain', 'drainage', 'clogged', 'blocked', 'toilet', 'sink', 'bathroom fitting',
      'water', 'shower',
      'প্লাম্বার', 'কল', 'পাইপ', 'পানি', 'লিক', 'ড্রেন', 'টয়লেট', 'বাথরুম',
    ],
  },
  {
    name: 'electrical',
    terms: [
      'electrician', 'electrical', 'electric', 'electricity', 'wiring', 'wire',
      'switch', 'socket', 'plug', 'light', 'lights', 'bulb', 'fan', 'ceiling fan',
      'power', 'fuse', 'short circuit', 'breaker',
      'ইলেকট্রিশিয়ান', 'বিদ্যুৎ', 'কারেন্ট', 'লাইট', 'বাতি', 'ফ্যান', 'পাখা', 'তার', 'সুইচ',
    ],
  },
  {
    name: 'moving',
    terms: [
      'move', 'moving', 'mover', 'movers', 'relocate', 'relocation', 'shift',
      'shifting', 'house shift', 'packing', 'lifting', 'truck', 'van', 'transport',
      'সরানো', 'স্থানান্তর', 'বাসা বদল', 'শিফট', 'পরিবহন', 'গাড়ি', 'ট্রাক',
    ],
  },
  {
    name: 'delivery',
    terms: [
      'deliver', 'delivery', 'parcel', 'package', 'courier', 'document', 'pickup',
      'pick up', 'drop off', 'groceries', 'grocery', 'medicine', 'food', 'errand',
      'errands',
      'ডেলিভারি', 'সরবরাহ', 'পার্সেল', 'কুরিয়ার', 'ওষুধ', 'খাবার', 'বাজার',
    ],
  },
  {
    name: 'tech support',
    terms: [
      'tech', 'technology', 'computer', 'laptop', 'pc', 'wifi', 'wi-fi', 'internet',
      'router', 'printer', 'software', 'virus', 'mobile', 'phone', 'smartphone',
      'setup', 'it support',
      'প্রযুক্তি', 'কম্পিউটার', 'ল্যাপটপ', 'ইন্টারনেট', 'ওয়াইফাই', 'মোবাইল', 'ফোন',
    ],
  },
  {
    name: 'tutoring',
    terms: [
      'tutor', 'tutoring', 'tuition', 'teacher', 'teach', 'lesson', 'lessons',
      'homework', 'math', 'maths', 'science', 'study', 'exam', 'exams', 'school',
      'college', 'student', 'education', 'academic',
      'শিক্ষক', 'টিউটর', 'টিউশন', 'পড়াশোনা', 'পড়ানো', 'শিক্ষা', 'পরীক্ষা', 'স্কুল',
    ],
  },
  {
    name: 'care',
    terms: [
      'elder', 'elderly', 'old', 'grandmother', 'grandfather', 'grandma', 'grandpa',
      'parents', 'caregiver', 'carer', 'nurse', 'patient', 'check-in', 'visit',
      'care',
      'যত্ন', 'বৃদ্ধ', 'বয়স্ক', 'নার্স', 'দাদা', 'দাদি', 'নানা', 'নানি', 'রোগী',
    ],
  },
  {
    name: 'appliance',
    terms: [
      'appliance', 'appliances', 'fridge', 'refrigerator', 'washing machine',
      'microwave', 'oven', 'tv', 'television', 'geyser', 'water heater',
      'ফ্রিজ', 'ওয়াশিং মেশিন', 'টিভি',
    ],
  },
  {
    name: 'painting',
    terms: ['paint', 'painting', 'painter', 'wall', 'walls', 'colour', 'color', 'রং'],
  },
  {
    name: 'gardening',
    terms: [
      'garden', 'gardening', 'gardener', 'lawn', 'grass', 'plant', 'plants', 'tree',
      'trees', 'landscaping', 'বাগান', 'গাছ',
    ],
  },
  {
    name: 'pest control',
    terms: [
      'pest', 'pests', 'cockroach', 'cockroaches', 'termite', 'termites', 'rat',
      'rats', 'mice', 'mouse', 'mosquito', 'mosquitoes', 'insect', 'insects', 'bug',
      'bugs', 'তেলাপোকা', 'উইপোকা', 'ইঁদুর', 'মশা', 'পোকা',
    ],
  },
  {
    name: 'carpentry',
    terms: [
      'carpenter', 'carpentry', 'wood', 'woodwork', 'wooden', 'furniture', 'door',
      'cabinet', 'cupboard', 'table', 'chair', 'কাঠ', 'আসবাব', 'দরজা',
    ],
  },
  {
    name: 'repair',
    weak: true,
    terms: [
      'repair', 'repairs', 'fix', 'fixing', 'broken', 'broke', 'not working',
      'stopped working', 'damaged', 'maintenance', 'servicing', 'installation',
      'install', 'মেরামত', 'নষ্ট', 'ঠিক', 'সার্ভিসিং',
    ],
  },
  {
    name: 'home',
    weak: true,
    terms: ['home', 'house', 'household', 'flat', 'apartment', 'office', 'ঘর', 'বাসা', 'বাড়ি', 'অফিস'],
  },
];

// filler words that say nothing about the service
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'but', 'can', 'could', 'do', 'for', 'from',
  'get', 'have', 'help', 'i', 'im', 'in', 'is', 'it', 'its', 'like', 'me', 'my',
  'need', 'needs', 'of', 'on', 'or', 'our', 'please', 'service', 'services',
  'someone', 'somebody', 'some', 'that', 'the', 'there', 'this', 'to', 'up', 'us',
  'want', 'we', 'with', 'would', 'you', 'your', 'today', 'tomorrow', 'now',
  'আমার', 'আমি', 'একটি', 'একজন', 'জন্য', 'চাই', 'দরকার', 'করতে', 'হবে', 'আমাদের',
]);

// all the tuning knobs in one place
export const MATCH_CONFIG = {
  weights: {
    conceptInName: 6,
    conceptInDescription: 3,
    weakConceptInName: 2,
    weakConceptInDescription: 1,
    wordInName: 4,
    wordInDescription: 1,
  },
  // the score that maps to confidence 1.0
  fullConfidenceScore: 10,
  maxResults: 5,
};

const BENGALI = /[ঀ-৿]/;

export function normalise(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    // keep letters, combining marks (bengali vowel signs are marks) and digits
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// very light english stemming so "leaking"/"leaks"/"leak" compare equal.
// not a real stemmer on purpose, just enough for spoken requests.
export function stem(word: string): string {
  if (BENGALI.test(word) || word.length <= 3) return word;
  for (const suffix of ['ing', 'ers', 'er', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// classic edit distance. speech-to-text often produces near misses like
// "plumer" or "electrition", which a distance of 1-2 forgives.
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

// short words are never fuzzy matched: "right" must not become "light"
function allowedTypos(word: string): number {
  if (word.length >= 9) return 2;
  if (word.length >= 6) return 1;
  return 0;
}

// does the spoken text contain this term?
// - bengali: substring (suffixes are glued on)
// - english phrase: exact stemmed phrase
// - english word: exact stemmed word, or a close typo of the unstemmed word
function spokenTextHasTerm(
  text: string,
  rawWords: string[],
  stemmedWords: string[],
  term: string,
): boolean {
  if (BENGALI.test(term)) return text.includes(term);

  const termWords = term.split(' ').map(stem);
  if (termWords.length > 1) {
    return ` ${stemmedWords.join(' ')} `.includes(` ${termWords.join(' ')} `);
  }

  if (stemmedWords.includes(termWords[0])) return true;
  const typos = allowedTypos(term);
  return typos > 0 && rawWords.some((word) => editDistance(word, term) <= typos);
}

// does the catalog text (always english) mention this term?
function catalogTextHasTerm(stemmedWords: string[], term: string): boolean {
  if (BENGALI.test(term)) return false;
  const termWords = term.split(' ').map(stem);
  return ` ${stemmedWords.join(' ')} `.includes(` ${termWords.join(' ')} `);
}

function stemmedWordsOf(text: string): string[] {
  return normalise(text).split(' ').filter(Boolean).map(stem);
}

// which concepts did the customer talk about, and which words triggered them
export function detectConcepts(transcript: string): { concept: Concept; heard: string }[] {
  const text = normalise(transcript);
  const rawWords = text.split(' ').filter((word) => word && !BENGALI.test(word));
  const words = stemmedWordsOf(text);
  const found: { concept: Concept; heard: string }[] = [];

  for (const concept of CONCEPTS) {
    const heard = concept.terms.find((term) => spokenTextHasTerm(text, rawWords, words, term));
    if (heard) found.push({ concept, heard });
  }
  return found;
}

function confidenceFromScore(score: number, config: typeof MATCH_CONFIG): number {
  return Math.round(Math.min(1, score / config.fullConfidenceScore) * 100) / 100;
}

// score every service against the transcript and return the best ones,
// most likely first. services that dont relate at all are left out.
export function matchTranscript(
  transcript: string,
  services: MatchableService[],
  config = MATCH_CONFIG,
): ServiceMatch[] {
  const w = config.weights;
  const concepts = detectConcepts(transcript);
  const spokenWords = Array.from(
    new Set(
      stemmedWordsOf(transcript).filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
    ),
  );

  const scored = services.map((service) => {
    const nameWords = stemmedWordsOf(service.serviceName);
    const descriptionWords = stemmedWordsOf(service.description || '');
    let score = 0;
    const reasons: string[] = [];

    // 1. concepts the customer mentioned that this service covers
    for (const { concept, heard } of concepts) {
      const inName = concept.terms.some((t) => catalogTextHasTerm(nameWords, t));
      const inDescription =
        !inName && concept.terms.some((t) => catalogTextHasTerm(descriptionWords, t));
      if (!inName && !inDescription) continue;

      if (concept.weak) {
        score += inName ? w.weakConceptInName : w.weakConceptInDescription;
      } else {
        score += inName ? w.conceptInName : w.conceptInDescription;
        reasons.push(`"${heard}" relates to ${concept.name}`);
      }
    }

    // 2. words said directly that appear in the service text
    for (const word of spokenWords) {
      if (nameWords.includes(word)) {
        score += w.wordInName;
        reasons.push(`mentions "${word}"`);
      } else if (descriptionWords.includes(word)) {
        score += w.wordInDescription;
      }
    }

    return { service, score, reasons };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxResults)
    .map(({ service, score, reasons }) => ({
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      confidence: confidenceFromScore(score, config),
      reason: reasons.length
        ? Array.from(new Set(reasons)).slice(0, 2).join('; ')
        : 'general match on the request',
    }));
}
