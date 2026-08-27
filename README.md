# TrustScore — Alternative Credit Scoring for Gig Workers

Hackathon prototype (Build $ Bank, Track 1, Problem 1). Converts 12 behavioral
and platform signals into a deterministic, explainable 100-point credit score
for gig delivery workers with income but no traditional credit history.

**Live demo:** https://trustscore-lavisha2649.vercel.app

## Stack
- Frontend: vanilla HTML/CSS/JS (single-page, scroll-based navigation)
- Backend: FastAPI (Python), deployed as a Vercel serverless function — see `api/index.py`
- Smart contract reference: `contracts/TrustScoreAttestation.sol` (Solidity, not deployed to any chain)

## Structure
- `index.html`, `styles.css`, `app.js`, `workers.js` — frontend
- `api/index.py` — FastAPI backend (scoring, loan policy, attestation, repayment, recovery)
- `requirements.txt` — Python deps
- `vercel.json` — routes `/api/*` to the FastAPI function
- `contracts/` — Solidity attestation contract (reference only, not deployed)
- `docs/` — scoring methodology and demo script

## Known limitations (documented honestly)
- No persistent server-side state — Vercel Python functions are stateless;
  session state lives in the browser tab. Would need Supabase/Postgres for
  cross-device/refresh persistence.
- The Solidity contract is not deployed to any chain or wired to the backend.
  `/api/verification/attest` reproduces the same authorized-signer accept/
  reject logic in Python for a working demo, but doesn't call the contract.
- Worker data is synthetic/mock, clearly labeled throughout the UI.

## Run locally
```
pip install -r requirements.txt --break-system-packages
uvicorn api.index:app --reload --port 8000
# serve index.html separately (e.g. python -m http.server 5500) and point
# fetch() calls at http://localhost:8000 if testing outside Vercel
```

## Deploy
Deployed via Vercel (auto-detects the Python function from `api/index.py`
and `requirements.txt`, static files served from the repo root).
