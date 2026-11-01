# AI evals

Unit tests check that the AI code does what we wrote. These evals check **how well** it works: each feature is scored against a labelled test set using standard metrics.

```bash
cd backend
npm run eval
```

The command prints a summary and rewrites [`RESULTS.md`](./RESULTS.md) with the full breakdown, including every miss and false alarm. It needs no database or API keys.

| Feature | Code under test | Dataset | Metrics |
| --- | --- | --- | --- |
| Service matching | `src/modules/services/matching/transcript-matcher.ts` | `datasets/service-matching.json` | Hit@1, Hit@3, MRR, plus no-match on out-of-catalog requests |
| Fake-review detection | `src/modules/reviews/moderation/fake-review-detector.ts` | `datasets/fake-reviews.json` | Precision, recall, F1 |
| Fake-account detection | `src/modules/providers/moderation/fake-account-detector.ts` | `datasets/fake-accounts.json` | Precision, recall, F1 |

## Ground rules

- The detectors run with their real production config. Don't tune them against these datasets and then quote the result as a score. Change the rules, rerun, and report the before and after.
- Labels come from the scenario each case represents, and they were written before the first run. If you add cases, label them before you run the eval.
- The service catalog is read from `database/seeds`, so the eval always uses the same services as the app.
- The datasets are small and team-written. Treat the results as indicative until they can be rebuilt from real, consented user data.
- The optional OpenAI matcher and the Claude "Screen with AI" second opinion need API keys, so they aren't part of this run.
- The account detector's v2 signals (sock-puppet ring, high review volume) were designed after seeing what v1 missed on `fake-accounts.json`. Its v2 score is therefore optimistic. Confirm it on account cases written after this change.
