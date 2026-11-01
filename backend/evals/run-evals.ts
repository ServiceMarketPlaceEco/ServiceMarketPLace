// ServiceHub AI evals
//
// unit tests check that the AI code does what we wrote. evals check how
// GOOD it is: we score each feature against a labelled test set and report
// standard metrics, so the slide numbers come from a run anyone can repeat.
//
//   npm run eval            prints the results and rewrites evals/RESULTS.md
//
// what gets evaluated (the code paths that run in production with no api key):
//   1. service matching   - transcript-matcher.ts (voice/text request -> service)
//   2. fake reviews       - fake-review-detector.ts (the "Scan reviews" queue)
//   3. fake accounts      - fake-account-detector.ts (the "Scan accounts" queue)
//
// the optional OpenAI matcher and the Claude "Screen with AI" second opinion
// need api keys and are not part of this run.
//
// the detectors are run with their real production config. nothing here is
// tuned to the datasets, and the labels were written before the first run.

import * as fs from 'fs';
import * as path from 'path';
import { matchTranscript, MatchableService } from '../src/modules/services/matching/transcript-matcher';
import { scoreReview, ScorableReview } from '../src/modules/reviews/moderation/fake-review-detector';
import { scoreAccount, ScorableAccount, ACCOUNT_DETECTION_CONFIG } from '../src/modules/providers/moderation/fake-account-detector';

const DATASETS = path.join(__dirname, 'datasets');
const SEEDS = path.join(__dirname, '..', 'database', 'seeds');

function load<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATASETS, file), 'utf8')) as T;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// the service catalog, read straight from the seed files so the eval always
// uses the same services the app does after `npm run db:setup`
// ---------------------------------------------------------------------------
function loadCatalog(): MatchableService[] {
  const services: MatchableService[] = [];
  const row = /INSERT INTO services[^;]*?SELECT UUID\(\),\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'/g;
  for (const file of fs.readdirSync(SEEDS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(SEEDS, file), 'utf8');
    for (const m of sql.matchAll(row)) {
      const name = m[1].replace(/''/g, "'");
      if (!services.some((s) => s.serviceName === name)) {
        services.push({ serviceId: name, serviceName: name, description: m[2].replace(/''/g, "'") });
      }
    }
  }
  return services;
}

// ---------------------------------------------------------------------------
// 1. service matching
// ---------------------------------------------------------------------------
interface MatchCase { id: string; slice: string; query: string; label: string; gloss?: string }
interface MatchDataset { groups: Record<string, string[]>; cases: MatchCase[] }

function evalMatching(lines: string[]) {
  const data = load<MatchDataset>('service-matching.json');
  const catalog = loadCatalog();
  for (const names of Object.values(data.groups)) {
    for (const n of names) {
      if (!catalog.some((s) => s.serviceName === n)) throw new Error(`label "${n}" is not in the seeded catalog`);
    }
  }

  type Row = { c: MatchCase; ranked: string[]; rank: number | null };
  const rows: Row[] = data.cases.map((c) => {
    const ranked = matchTranscript(c.query, catalog).map((m) => m.serviceName);
    const relevant = data.groups[c.label];
    const idx = ranked.findIndex((r) => relevant.includes(r));
    return { c, ranked, rank: idx === -1 ? null : idx + 1 };
  });

  const inScope = rows.filter((r) => data.groups[r.c.label].length > 0);
  const outScope = rows.filter((r) => data.groups[r.c.label].length === 0);
  const stats = (rs: Row[]) => ({
    n: rs.length,
    hit1: rs.filter((r) => r.rank === 1).length / rs.length,
    hit3: rs.filter((r) => r.rank !== null && r.rank <= 3).length / rs.length,
    mrr: rs.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / rs.length,
  });
  const all = stats(inScope);
  const abstain = outScope.filter((r) => r.ranked.length === 0).length;

  lines.push('## 1. Service matching (voice and text requests)', '');
  lines.push(`Catalog: ${catalog.length} services from \`database/seeds\`. Test set: ${inScope.length} in-catalog requests plus ${outScope.length} out-of-catalog requests.`, '');
  lines.push('| Slice | Requests | Hit@1 | Hit@3 | MRR |', '| --- | --- | --- | --- | --- |');
  const slices = Array.from(new Set(inScope.map((r) => r.c.slice)));
  for (const s of slices) {
    const st = stats(inScope.filter((r) => r.c.slice === s));
    lines.push(`| ${s} | ${st.n} | ${pct(st.hit1)} | ${pct(st.hit3)} | ${st.mrr.toFixed(2)} |`);
  }
  lines.push(`| **All in-catalog** | **${all.n}** | **${pct(all.hit1)}** | **${pct(all.hit3)}** | **${all.mrr.toFixed(2)}** |`, '');
  lines.push(`Out-of-catalog requests correctly given no match: **${abstain}/${outScope.length}**.`, '');
  lines.push('Hit@k: share of requests where a correct service is in the top k results. MRR: mean of 1/rank of the first correct service (0 when none is returned).', '');

  const misses = rows.filter((r) => (data.groups[r.c.label].length ? r.rank !== 1 : r.ranked.length > 0));
  lines.push('<details><summary>Requests the matcher got wrong (' + misses.length + ')</summary>', '');
  lines.push('| ID | Request | Expected | Top results |', '| --- | --- | --- | --- |');
  for (const r of misses) {
    const q = r.c.gloss ? `${r.c.query} (${r.c.gloss})` : r.c.query;
    const exp = data.groups[r.c.label].join(' / ') || 'no match';
    lines.push(`| ${r.c.id} | ${q} | ${exp} | ${r.ranked.slice(0, 3).join(', ') || '(none)'} |`);
  }
  lines.push('', '</details>', '');
  return { ...all, abstain, outN: outScope.length };
}

// ---------------------------------------------------------------------------
// shared binary-classifier scoring
// ---------------------------------------------------------------------------
interface Labelled { id: string; label: 'fake' | 'genuine'; scenario: string }
function confusion<T extends Labelled>(cases: T[], flagged: (c: T) => boolean) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const fps: T[] = [], fns: T[] = [];
  for (const c of cases) {
    const f = flagged(c);
    if (f && c.label === 'fake') tp++;
    else if (f) { fp++; fps.push(c); }
    else if (c.label === 'fake') { fn++; fns.push(c); }
    else tn++;
  }
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, tn, precision, recall, f1, fps, fns, n: cases.length };
}

function confusionLines(lines: string[], m: ReturnType<typeof confusion>) {
  lines.push('| | Flagged | Not flagged |', '| --- | --- | --- |');
  lines.push(`| **Fake** | ${m.tp} (true positive) | ${m.fn} (missed) |`);
  lines.push(`| **Genuine** | ${m.fp} (false alarm) | ${m.tn} (correctly left alone) |`, '');
  lines.push(`**Precision ${pct(m.precision)} · Recall ${pct(m.recall)} · F1 ${m.f1.toFixed(2)}**`, '');
}

function groupByScenario<T extends Labelled>(cs: T[]): string {
  const counts = new Map<string, string[]>();
  for (const c of cs) counts.set(c.scenario, [...(counts.get(c.scenario) || []), c.id]);
  return Array.from(counts, ([s, ids]) => `- ${s}: ${ids.join(', ')}`).join('\n');
}

// ---------------------------------------------------------------------------
// 2. fake reviews
// ---------------------------------------------------------------------------
interface ReviewCase extends Labelled {
  provider: string; day: number; accountAgeDays: number; completedBooking: boolean; rating: number; comment: string;
}

function evalReviews(lines: string[]) {
  const { cases } = load<{ cases: ReviewCase[] }>('fake-reviews.json');
  const start = Date.UTC(2026, 7, 1);
  const DAY = 24 * 60 * 60 * 1000;
  const batch: ScorableReview[] = cases.map((c) => ({
    reviewId: c.id,
    customerId: `cust-${c.id}`,
    providerId: c.provider,
    rating: c.rating,
    comment: c.comment,
    createdAt: new Date(start + c.day * DAY),
    customerCreatedAt: new Date(start + (c.day - c.accountAgeDays) * DAY),
    hasCompletedBookingWithProvider: c.completedBooking,
  }));
  const flagged = new Set(batch.map((r) => scoreReview(r, batch)).filter((s) => s.flagged).map((s) => s.reviewId));
  const m = confusion(cases, (c) => flagged.has(c.id));

  const fakes = cases.filter((c) => c.label === 'fake').length;
  lines.push('## 2. Fake-review detection', '');
  lines.push(`Test set: ${cases.length} reviews (${fakes} fake, ${cases.length - fakes} genuine) across 12 providers over 60 days, scanned as one batch like the admin "Scan reviews" button.`, '');
  confusionLines(lines, m);
  lines.push('Missed fakes, by scenario:', '', groupByScenario(m.fns) || '- none', '');
  lines.push('False alarms on genuine reviews, by scenario:', '', groupByScenario(m.fps) || '- none', '');
  return m;
}

// ---------------------------------------------------------------------------
// 3. fake accounts
// ---------------------------------------------------------------------------
interface AccountCase extends Labelled, Omit<ScorableAccount, 'accountId'> {}

function evalAccounts(lines: string[]) {
  const { cases } = load<{ cases: AccountCase[] }>('fake-accounts.json');
  const batch: ScorableAccount[] = cases.map((c) => ({
    accountId: c.id,
    kind: c.kind,
    email: c.email,
    phone: c.phone,
    completedBookings: c.completedBookings,
    reviewsWritten: c.reviewsWritten,
    distinctProvidersReviewed: c.distinctProvidersReviewed,
    reviewedProviderIds: c.reviewedProviderIds,
  }));
  const run = (config: typeof ACCOUNT_DETECTION_CONFIG) => {
    const flagged = new Set(batch.map((a) => scoreAccount(a, batch, config)).filter((s) => s.flagged).map((s) => s.accountId));
    return confusion(cases, (c) => flagged.has(c.id));
  };
  const m = run(ACCOUNT_DETECTION_CONFIG);
  // v1 = the detector before the ring and high-volume signals were added.
  // zeroing their weights reproduces it exactly.
  const v1 = run({
    ...ACCOUNT_DETECTION_CONFIG,
    weights: { ...ACCOUNT_DETECTION_CONFIG.weights, sockPuppetRing: 0, highReviewVolume: 0 },
  });

  const fakes = cases.filter((c) => c.label === 'fake').length;
  lines.push('## 3. Fake-account detection', '');
  lines.push(`Test set: ${cases.length} accounts (${fakes} fake, ${cases.length - fakes} genuine), with the same fields the admin "Scan accounts" button reads.`, '');
  confusionLines(lines, m);
  lines.push('| Detector version | Precision | Recall | F1 | Missed fakes | False alarms |', '| --- | --- | --- | --- | --- | --- |');
  lines.push(`| v1: identity, sock-puppet and no-booking signals | ${pct(v1.precision)} | ${pct(v1.recall)} | ${v1.f1.toFixed(2)} | ${v1.fn} | ${v1.fp} |`);
  lines.push(`| v2: adds sock-puppet ring and high review volume (current) | ${pct(m.precision)} | ${pct(m.recall)} | ${m.f1.toFixed(2)} | ${m.fn} | ${m.fp} |`, '');
  lines.push('Missed fakes, by scenario:', '', groupByScenario(m.fns) || '- none', '');
  lines.push('False alarms on genuine accounts, by scenario:', '', groupByScenario(m.fps) || '- none', '');
  return m;
}

// ---------------------------------------------------------------------------
function main() {
  const body: string[] = [];
  const match = evalMatching(body);
  const reviews = evalReviews(body);
  const accounts = evalAccounts(body);

  const summary = [
    '# ServiceHub AI eval results',
    '',
    'Generated by `npm run eval` (backend/evals/run-evals.ts). Do not edit by hand; rerun the eval instead.',
    '',
    '| Feature | What we measure | Test set | Result |',
    '| --- | --- | --- | --- |',
    `| Service matching | Is a right service ranked first / in the top 3? | ${match.n} labelled requests (+${match.outN} out of catalog) | Hit@1 ${pct(match.hit1)} · Hit@3 ${pct(match.hit3)} |`,
    `| Fake-review detection | Precision and recall on flagged reviews | ${reviews.n} reviews (${reviews.tp + reviews.fn} fake) | ${pct(reviews.precision)} / ${pct(reviews.recall)} |`,
    `| Fake-account detection | Precision and recall on flagged accounts | ${accounts.n} accounts (${accounts.tp + accounts.fn} fake) | ${pct(accounts.precision)} / ${pct(accounts.recall)} |`,
    '',
    '**Caveats.** The test sets are small and were written and labelled by the team, not drawn from real Bangladeshi users, so treat these as indicative numbers. They evaluate the rule-based code paths only; the optional OpenAI matcher and the Claude second opinion need API keys and are not included. The v2 account signals were designed after seeing the v1 misses on this test set, so their score here is optimistic until they are checked on new cases.',
    '',
  ];
  const report = [...summary, ...body].join('\n');
  fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), report + '\n');
  console.log(summary.slice(4, 9).join('\n'));
  console.log('\nFull report written to evals/RESULTS.md');
}

main();
