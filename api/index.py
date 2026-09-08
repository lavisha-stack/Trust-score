"""
Aegis API — FastAPI backend.

Deterministic prototype for alternative credit scoring. The scoring and loan
policies below are transparent hackathon assumptions, not empirically
validated underwriting rules. In production, weights and pricing would be
calibrated against historical repayment/default data and monitored for bias.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Literal
import hashlib
import time

app = FastAPI(title="TrustScore API", version="0.1.0")

SIGNAL_ORDER = [
    "workConsistency", "platformRating", "completionRate", "earningsVolatility",
    "tenureMonths", "paymentReliability", "cancellationRate", "upiRegularity",
    "savingsBehaviour", "incomeDiversification", "workAvailability", "vehicleAsset",
]

# Prototype weights: chosen for expected signal reliability and relevance.
# They are intentionally transparent and deterministic for the hackathon.
SIGNAL_META = {
    "workConsistency":       {"label": "Work Consistency",             "max": 15, "category": "core"},
    "platformRating":        {"label": "Platform Rating",              "max": 12, "category": "core"},
    "completionRate":        {"label": "Completion Rate",              "max": 12, "category": "core"},
    "earningsVolatility":    {"label": "Income Stability",             "max": 12, "category": "supporting"},
    "tenureMonths":          {"label": "Platform Tenure",               "max": 10, "category": "core"},
    "paymentReliability":    {"label": "Payment Reliability",           "max": 10, "category": "core"},
    "cancellationRate":      {"label": "Cancellation Rate",             "max": 8,  "category": "supporting"},
    "upiRegularity":         {"label": "UPI Transaction Regularity",    "max": 6,  "category": "supporting"},
    "savingsBehaviour":      {"label": "Savings Behaviour",             "max": 5,  "category": "supporting"},
    "incomeDiversification": {"label": "Income Diversification",       "max": 4,  "category": "supporting"},
    "workAvailability":      {"label": "Work Availability Consistency", "max": 3, "category": "supporting"},
    "vehicleAsset":          {"label": "Vehicle / Asset Ownership",     "max": 3, "category": "supporting"},
}
assert sum(m["max"] for m in SIGNAL_META.values()) == 100


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def normalize(key: str, raw) -> float:
    if key == "workConsistency": return clamp(raw, 0, 100)
    if key == "platformRating": return clamp((raw / 5) * 100, 0, 100)
    if key == "completionRate": return clamp(raw, 0, 100)
    if key == "earningsVolatility": return clamp(100 - (raw / 0.5) * 100, 0, 100)
    if key == "tenureMonths": return clamp((raw / 24) * 100, 0, 100)
    if key == "paymentReliability": return clamp(raw, 0, 100)
    if key == "cancellationRate": return clamp(100 - (raw / 10) * 100, 0, 100)
    if key == "upiRegularity": return clamp(raw, 0, 100)
    if key == "savingsBehaviour": return clamp(raw, 0, 100)
    if key == "incomeDiversification": return clamp((raw / 15) * 100, 0, 100)
    if key == "workAvailability": return clamp(raw, 0, 100)
    if key == "vehicleAsset": return {"owned": 100, "financed": 60, "none": 20}.get(raw, 20)
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
    if total >= 90: return "STRONG", "Best rate / highest starter cap"
    if total >= 75: return "GOOD", "Good rate / strong starter cap"
    if total >= 60: return "STANDARD", "Standard rate / moderate starter cap"
    if total >= 40: return "STARTER", "Higher rate / small starter loan"
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
            "key": key, "label": meta["label"], "category": meta["category"],
            "maxPoints": meta["max"], "raw": raw,
            "normalized": round(norm, 1), "awardedPoints": awarded,
        })
    total = round(total, 1)
    band, band_label = score_band(total)
    return {"total": total, "maxTotal": 100, "band": band,
            "bandLabel": band_label, "breakdown": breakdown}


# Prototype pricing policy. These rates are illustrative, not "optimal".
# They are informed by observed Indian personal-loan ranges, but a real
# lender would price from cost of funds, operating costs, risk premium and
# validated default data. SBI publishes personal-loan rates from 10.05% p.a.;
# ICICI publishes 13%-16% for its credit-card personal-loan product. Neither
# is a direct benchmark for gig-worker lending.
LOAN_POLICY = {
    "STRONG":   {"pct": 0.50, "rate": 0.14, "label": "14% p.a. (illustrative prototype rate)"},
    "GOOD":     {"pct": 0.40, "rate": 0.17, "label": "17% p.a. (illustrative prototype rate)"},
    "STANDARD": {"pct": 0.30, "rate": 0.20, "label": "20% p.a. (illustrative prototype rate)"},
    "STARTER":  {"pct": 0.15, "rate": 0.24, "label": "24% p.a. (illustrative prototype rate)"},
    "DECLINED": {"pct": 0.00, "rate": 0.00, "label": "Not eligible yet"},
}


class LoanRequest(BaseModel):
    band: Literal["STRONG", "GOOD", "STANDARD", "STARTER", "DECLINED"]
    monthlyIncome: float


@app.post("/api/loan/create")
def create_loan(body: LoanRequest):
    policy = LOAN_POLICY[body.band]
    amount = round((body.monthlyIncome * policy["pct"]) / 500) * 500
    repayment_total = round(amount * (1 + policy["rate"]))
    return {
        "eligible": body.band != "DECLINED", "amount": amount,
        "repaymentTotal": repayment_total, "rateLabel": policy["label"],
        "ratePct": policy["rate"], "targetDays": 30, "bufferDays": 15,
        "maxNormalWindowDays": 45,
    }


AUTHORIZED_SIGNERS = {"trustscore-verification-service"}

class AttestRequest(BaseModel):
    workerId: str
    signerId: str

@app.post("/api/verification/attest")
def attest(body: AttestRequest):
    claim_source = f"{body.workerId}:{int(time.time())}"
    claim_hash = hashlib.sha256(claim_source.encode()).hexdigest()
    authorized = body.signerId in AUTHORIZED_SIGNERS
    return {"claimHash": claim_hash, "signerId": body.signerId,
            "accepted": authorized, "status": "AUTHORIZED" if authorized else "REJECTED"}


REPAYMENT_STATES = {
    "NO_HISTORY": {"score": 15, "label": "No repayment history yet", "note": "N/A — first-time borrower. No penalty."},
    "ON_TIME": {"score": 15, "label": "On-time, complete repayment", "note": "Strengthens future eligibility."},
    "MINOR_DELAY": {"score": 11, "label": "Minor delay within buffer", "note": "Small reduction — still within buffer."},
    "PARTIAL": {"score": 7, "label": "Partial repayment", "note": "Proportional reduction."},
    "OVERDUE": {"score": 3, "label": "Missed repayment beyond grace", "note": "Material reduction — past day 45."},
    "SEVERE_DEFAULT": {"score": 0, "label": "Repeated / severe default", "note": "Approaching zero."},
    "RECOVERED": {"score": 10, "label": "Rehabilitated", "note": "Recovering after resumed repayment."},
}

class RepaymentRecordRequest(BaseModel):
    state: Literal["NO_HISTORY", "ON_TIME", "MINOR_DELAY", "PARTIAL", "OVERDUE", "SEVERE_DEFAULT", "RECOVERED"]

@app.post("/api/repayment/record")
def record_repayment(body: RepaymentRecordRequest):
    return REPAYMENT_STATES[body.state]

@app.post("/api/repayment/simulate-income")
@app.get("/api/repayment/simulate-income")
def simulate_income():
    income = 3000
    allocation_rate = 0.10
    allocation = round(income * allocation_rate)
    return {"income": income, "allocationRate": allocation_rate,
            "allocation": allocation, "available": income - allocation}


# Borrower-friendly prototype recovery: a single 10% deduction from the
# remaining balance after Day 45. This is a demo assumption, not a production
# collections rule. A real product would need legal/compliance review,
# borrower notice, hardship handling and appropriate consent.
RECOVERY_RATE = 0.10

class RecoveryRequest(BaseModel):
    outstanding: float
    alreadyTriggered: bool = False

@app.post("/api/recovery/trigger")
def trigger_recovery(body: RecoveryRequest):
    if body.alreadyTriggered:
        raise HTTPException(status_code=409, detail="Recovery already applied for this loan.")
    recovery_amount = round(body.outstanding * RECOVERY_RATE)
    return {"triggered": True, "recoveryAmount": recovery_amount,
            "remaining": body.outstanding - recovery_amount, "rate": RECOVERY_RATE}

@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "deterministic", "weightsSum": sum(m["max"] for m in SIGNAL_META.values())}
