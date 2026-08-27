# TrustScore — Scoring Methodology (Prototype)

**Status: hackathon prototype. Not empirically validated. Not affiliated with any real lender, credit bureau, or platform.**

## 1. Pipeline
Worker data → Verification (authorized attestation) → Signal normalization →
Weighted scoring (100 pts) → Score band → Loan policy → Repayment performance
(separate, 0–15) → Repayment ladder → Recovery (if needed).

## 2. The 12 signals (sum to exactly 100 points)

| # | Signal | Category | Max points |
|---|---|---|---|
| 1 | Work Consistency | Core | 15 |
| 2 | Platform Rating | Core | 12 |
| 3 | Completion Rate | Core | 12 |
| 4 | Income Stability (Earnings Volatility) | Supporting | 12 |
| 5 | Platform Tenure | Core | 10 |
| 6 | Payment Reliability | Core | 10 |
| 7 | Cancellation Rate | Supporting | 8 |
| 8 | UPI Transaction Regularity | Supporting | 6 |
| 9 | Savings Behaviour | Supporting | 5 |
| 10 | Income Diversification | Supporting | 4 |
| 11 | Work Availability Consistency | Supporting | 3 |
| 12 | Vehicle / Asset Ownership | Supporting | 3 |

**Core signals** are the five most platform-verifiable and are weighted highest.
**Supporting signals** add texture but are not independently validated to the
same degree, and are intentionally capped at lower weights — in particular,
Vehicle/Asset Ownership is supporting information only and must not
materially drive the credit decision.

## 3. Normalization policy (see `scoring.js` for exact code)
Every raw signal is normalized to a 0–100% scale, then multiplied by its max
points. All thresholds (e.g. "24 months tenure = full tenure credit", "10%
cancellation rate = zero credit") are prototype policy choices, documented in
code comments, and are flagged here as such rather than hidden.

Income Diversification measures **resilience** (does a secondary income
source meaningfully offset single-platform dependency?), not simply the raw
count of platforms a worker uses.

Work Availability Consistency measures whether a worker shows up within
**their own declared availability windows** — it does not reward working in
dangerous or adverse conditions.

## 4. Score bands
- 80–100 **STRONG** — best rate / highest starter cap
- 60–79 **STANDARD** — standard rate / moderate starter cap
- 40–59 **STARTER** — higher rate / small starter loan
- <40 **DECLINED** — not yet eligible; improve signals first

## 5. Repayment Performance is separate from the 100-point score
First-time borrowers start at **15/15** with no penalty for lacking prior
borrowing history — this prevents the credit-invisible from being penalized
twice for the same problem the product exists to solve. Once a loan is
active, Repayment Performance moves based on observed repayment behaviour
only (never inferred intent).

## 6. Recovery
If no repayment has occurred by day 45, a **10%** simulated recovery
deduction is applied to the outstanding amount from simulated incoming
earnings. This cannot be triggered twice for the same loan. A 15% policy
variant exists in configuration but is not the active value in this demo.

## 7. What this prototype does not claim
No real Swiggy/Zomato/bank/Account Aggregator integration exists. No ML or
LLM model makes the credit decision — the scoring engine is fully
deterministic and auditable. No demographic or unrelated personal
attributes are used anywhere in scoring.
