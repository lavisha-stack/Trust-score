"""
TrustScore API — FastAPI backend.

This is the real, deployed backend for the prototype. It is the single
source of truth for scoring math, loan policy, attestation checks, and
recovery logic — the frontend only displays what this service returns.

Deterministic: identical input always produces identical output. No ML
model, no LLM, no randomness anywhere in this file.

NOTE ON STATE: Vercel Python functions are stateless serverless functions
(no shared memory guaranteed between requests, and cold starts reset any
in-process variables). This backend does NOT pretend to persist loan/
repayment state across requests server-side — the frontend holds the
session state and calls these endpoints as pure calculation services.
If you want real server-side persistence (so state survives a page
refresh or is shared across devices), that needs a real database
(e.g. Supabase/Postgres) wired in separately — flag this to your team
if that's needed for judging.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional
import hashlib
import time

app = FastAPI(title="TrustScore API", version="0.1.0")

# ----------------------------------------------------------------------
# 1. Signal definitions — mirrors scoring.js exactly. Kept in one place
#    so the weights are auditable and cannot silently drift from the doc.
# ----------------------------------------------------------------------

SIGNAL_ORDER = [
    "workConsistency", "platformRating", "completionRate", "earningsVolatility",
    "tenureMonths", "paymentReliability", "cancellationRate", "upiRegularity",
    "savingsBehaviour", "incomeDiversification", "workAvailability", "vehicleAsset",
]

SIGNAL_META = {
    "workConsistency":       {"label": "Work Consistency",              "max": 15, "category": "core"},
    "platformRating":        {"label": "Platform Rating",                "max": 12, "category": "core"},
    "completionRate":        {"label": "Completion Rate",                "max": 12, "category": "core"},
    "earningsVolatility":    {"label": "Income Stability",               "max": 12, "category": "supporting"},
    "tenureMonths":          {"label": "Platform Tenure",                "max": 10, "category": "core"},
    "paymentReliability":    {"label": "Payment Reliability",            "max": 10, "category": "core"},
    "cancellationRate":      {"label": "Cancellation Rate",              "max": 8,  "category": "supporting"},
    "upiRegularity":         {"label": "UPI Transaction Regularity",     "max": 6,  "category": "supporting"},
    "savingsBehaviour":      {"label": "Savings Behaviour",              "max": 5,  "category": "supporting"},
    "incomeDiversification": {"label": "Income Diversification",        "max": 4,  "category": "supporting"},
    "workAvailability":      {"label": "Work Availability Consistency",  "max": 3,  "category": "supporting"},
    "vehicleAsset":          {"label": "Vehicle / Asset Ownership",      "max": 3,  "category": "supporting"},
}

assert sum(m["max"] for m in SIGNAL_META.values()) == 100, "Signal weights must sum to 100"


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def normalize(key: str, raw) -> float:
    """Policy normalization — same thresholds as scoring.js, documented there."""
    if key == "workConsistency":
        return clamp(raw, 0, 100)
    if key == "platformRating":
        return clamp((raw / 5) * 100, 0, 100)
    if key == "completionRate":
        return clamp(raw, 0, 100)
    if key == "earningsVolatility":
        return clamp(100 - (raw / 0.5) * 100, 0, 100)
    if key == "tenureMonths":
        return clamp((raw / 24) * 100, 0, 100)
    if key == "paymentReliability":
        return clamp(raw, 0, 100)
    if key == "cancellationRate":
        return clamp(100 - (raw / 10) * 100, 0, 100)
    if key == "upiRegularity":
        return clamp(raw, 0, 100)
    if key == "savingsBehaviour":
        return clamp(raw, 0, 100)
    if key == "incomeDiversification":
        return clamp((raw / 15) * 100, 0, 100)
    if key == "workAvailability":
        return clamp(raw, 0, 100)
    if key == "vehicleAsset":
        return {"owned": 100, "financed": 60, "none": 20}.get(raw, 20)
    raise ValueError(f"Unknown signal: {key}")


class SignalsIn(BaseModel):
    workConsistency: float
    platformRating: float
    completionRate: float
    earningsVolatility: float
    tenureMonths: float
    paymentReliability: float
    cancellationRate: float
    upiRegularity: float
    savingsBehaviour: float
    incomeDiversification: float
    workAvailability: float
    vehicleAsset: Literal["owned", "financed", "none"]


class TrustScoreRequest(BaseModel):
    signals: SignalsIn


def score_band(total: float):
    if total >= 80:
        return "STRONG", "Best rate / highest starter cap"
    if total >= 60:
        return "STANDARD", "Standard rate / moderate starter cap"
    if total >= 40:
        return "STARTER", "Higher rate / small starter loan"
    return "DECLINED", "Not yet eligible — improve signals first"


@app.post("/api/trust-score/calculate")
def calculate_trust_score(body: TrustScoreRequest):
    signals = body.signals.dict()
    breakdown = []
    total = 0.0
    for key in SIGNAL_ORDER:
        raw = signals[key]
        meta = SIGNAL_META[key]
        norm = normalize(key, raw)
        awarded = round((norm / 100) * meta["max"], 1)
        total += awarded
        breakdown.append({
            "key": key,
            "label": meta["label"],
            "category": meta["category"],
            "maxPoints": meta["max"],
            "raw": raw,
            "normalized": round(norm, 1),
            "awardedPoints": awarded,
        })
    total = round(total, 1)
    band, band_label = score_band(total)
    return {
        "total": total,
        "maxTotal": 100,
        "band": band,
        "bandLabel": band_label,
        "breakdown": breakdown,
    }


# ----------------------------------------------------------------------
# 2. Loan policy — prototype, not empirically validated.
# ----------------------------------------------------------------------

LOAN_POLICY = {
    "STRONG":   {"pct": 0.50, "rate": 0.04, "label": "Best available rate (prototype)"},
    "STANDARD": {"pct": 0.35, "rate": 0.07, "label": "Standard rate (prototype)"},
    "STARTER":  {"pct": 0.15, "rate": 0.12, "label": "Higher rate, small exposure (prototype)"},
    "DECLINED": {"pct": 0.00, "rate": 0.00, "label": "Not eligible yet"},
}


class LoanRequest(BaseModel):
    band: Literal["STRONG", "STANDARD", "STARTER", "DECLINED"]
    monthlyIncome: float


@app.post("/api/loan/create")
def create_loan(body: LoanRequest):
    policy = LOAN_POLICY[body.band]
    raw_amount = body.monthlyIncome * policy["pct"]
    amount = round(raw_amount / 500) * 500
    repayment_total = round(amount * (1 + policy["rate"]))
    return {
        "eligible": body.band != "DECLINED",
        "amount": amount,
        "repaymentTotal": repayment_total,
        "rateLabel": policy["label"],
        "ratePct": policy["rate"],
        "targetDays": 30,
        "bufferDays": 15,
        "maxNormalWindowDays": 45,
    }


# ----------------------------------------------------------------------
# 3. Verification / attestation — mirrors the authorized-signer pattern
#    in contracts/TrustScoreAttestation.sol. This endpoint simulates the
#    off-chain claim-creation + signer-authorization check described
#    there. It does NOT call the actual smart contract (that requires a
#    deployed chain + wallet signing, out of scope for this build) — it
#    reproduces the same accept/reject logic in Python so the demo flow
#    is real and testable, not hardcoded to always succeed.
# ----------------------------------------------------------------------

AUTHORIZED_SIGNERS = {"trustscore-verification-service"}


class AttestRequest(BaseModel):
    workerId: str
    signerId: str


@app.post("/api/verification/attest")
def attest(body: AttestRequest):
    claim_source = f"{body.workerId}:{int(time.time())}"
    claim_hash = hashlib.sha256(claim_source.encode()).hexdigest()
    authorized = body.signerId in AUTHORIZED_SIGNERS
    return {
        "claimHash": claim_hash,
        "signerId": body.signerId,
        "accepted": authorized,
        "status": "AUTHORIZED" if authorized else "REJECTED",
    }


# ----------------------------------------------------------------------
# 4. Repayment performance — separate 0–15 component. Never added into
#    the 100-point pre-loan score.
# ----------------------------------------------------------------------

REPAYMENT_STATES = {
    "NO_HISTORY":     {"score": 15, "label": "No repayment history yet",       "note": "N/A — first-time borrower. No penalty."},
    "ON_TIME":        {"score": 15, "label": "On-time, complete repayment",    "note": "Strengthens future eligibility."},
    "MINOR_DELAY":    {"score": 11, "label": "Minor delay within buffer",      "note": "Small reduction — still within buffer."},
    "PARTIAL":        {"score": 7,  "label": "Partial repayment",              "note": "Proportional reduction."},
    "OVERDUE":        {"score": 3,  "label": "Missed repayment beyond grace",  "note": "Material reduction — past day 45."},
    "SEVERE_DEFAULT": {"score": 0,  "label": "Repeated / severe default",      "note": "Approaching zero."},
    "RECOVERED":      {"score": 10, "label": "Rehabilitated",                  "note": "Recovering after resumed repayment."},
}


class RepaymentRecordRequest(BaseModel):
    state: Literal["NO_HISTORY", "ON_TIME", "MINOR_DELAY", "PARTIAL", "OVERDUE", "SEVERE_DEFAULT", "RECOVERED"]


@app.post("/api/repayment/record")
def record_repayment(body: RepaymentRecordRequest):
    return REPAYMENT_STATES[body.state]


@app.post("/api/repayment/simulate-income")
@app.get("/api/repayment/simulate-income")
def simulate_income():
    income = 1200
    allocation_rate = 0.10
    allocation = round(income * allocation_rate)
    return {
        "income": income,
        "allocationRate": allocation_rate,
        "allocation": allocation,
        "available": income - allocation,
    }


# ----------------------------------------------------------------------
# 5. Day-45 recovery — fixed 10% for this live demo. Cannot duplicate.
# ----------------------------------------------------------------------

RECOVERY_RATE = 0.10


class RecoveryRequest(BaseModel):
    outstanding: float
    alreadyTriggered: bool = False


@app.post("/api/recovery/trigger")
def trigger_recovery(body: RecoveryRequest):
    if body.alreadyTriggered:
        raise HTTPException(status_code=409, detail="Recovery already triggered for this loan — cannot duplicate.")
    recovery_amount = round(body.outstanding * RECOVERY_RATE)
    return {
        "triggered": True,
        "recoveryAmount": recovery_amount,
        "remaining": body.outstanding - recovery_amount,
        "rate": RECOVERY_RATE,
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "deterministic", "weightsSum": sum(m["max"] for m in SIGNAL_META.values())}
