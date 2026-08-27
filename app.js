(function () {
  const WORKERS = window.WORKERS;

  const STEPS = [
    { id: "landing", label: "Start" },
    { id: "worker", label: "Worker" },
    { id: "verify", label: "Verify" },
    { id: "score", label: "TrustScore" },
    { id: "compare", label: "Vs Traditional" },
    { id: "loan", label: "Loan Offer" },
    { id: "repay", label: "Repayment" },
    { id: "ladder", label: "Ladder" },
    { id: "recovery", label: "Recovery" },
    { id: "methodology", label: "Methodology" },
  ];

  let state = {
    worker: WORKERS[0],
    attestation: "PENDING",
    trustScoreResult: null,
    loan: null,
    repayment: { state: "NO_HISTORY", performance: 15, outstanding: 0 },
    ladderStage: 1,
    escalationIndex: -1,
    recoveryTriggered: false,
    auditLog: [],
  };

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
  function fmt(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

  async function api(path, body) {
    try {
      const res = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `API error (${res.status})`);
      }
      return await res.json();
    } catch (e) {
      toast(`API request failed: ${e.message}. Is the backend deployed?`, "error");
      throw e;
    }
  }

  function log(msg) {
    const t = new Date();
    const time = t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    state.auditLog.unshift({ time, msg });
    renderAuditLog();
  }

  function toast(msg, type = "") {
    const wrap = $("#toast-wrap");
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  const I18N = {
    en: {},
    hi: {
      hero_eyebrow: "उन लोगों के लिए पैसा जिन्हें बैंक अभी नहीं देखता",
      hero_title: "₹28,000 कमाए।<br><span class=\"accent\">फिर भी</span> बैंक के लिए अदृश्य।",
      hero_sub: "TrustScore आपके काम को देखता है — कागज़ात को नहीं — छोटा लोन देने के लिए।",
      cta_check: "अपना TrustScore देखें",
      cta_how: "यह कैसे काम करता है",
      worker_eyebrow: "आज़माएं",
      worker_title: "किसी वर्कर का स्कोर देखें",
      verify_eyebrow: "चरण 1",
      verify_title: "डेटा असली है या नहीं, यह जांचना",
      score_eyebrow: "चरण 2",
      score_title: "आपका TrustScore",
      signals_title: "12 बातें जो हम जांचते हैं",
      compare_eyebrow: "चरण 3",
      compare_title: "बैंक लोन बनाम TrustScore",
      loan_eyebrow: "चरण 4",
      loan_title: "शुरुआती लोन ऑफर",
      repay_eyebrow: "चरण 5",
      repay_title: "पैसे वापस चुकाना",
      ladder_eyebrow: "चरण 6",
      ladder_title: "हर सही भुगतान से भरोसा बढ़ता है",
      recovery_eyebrow: "अगर भुगतान छूट जाए",
      recovery_title: "अगर आप भुगतान नहीं कर पाते तो क्या होगा",
      method_eyebrow: "जजों और समीक्षकों के लिए",
      method_title: "स्कोर की गणना कैसे होती है",
      link_title: "अपना डेटा जोड़ें",
      link_sub: "आप जो जोड़ना चाहें चुनें। यह सिर्फ डेमो के लिए है — कोई असली फ़ाइल कहीं नहीं भेजी जाती।",
      link_platform_title: "प्लेटफ़ॉर्म डेटा जोड़ें",
      link_platform_sub: "आपकी डिलीवरी ऐप आपकी रेटिंग, ट्रिप्स और काम का समय भेजती है — सुरक्षित तरीके से।",
      link_platform_btn: "प्लेटफ़ॉर्म जोड़ें (मॉक)",
      link_upload_title: "अन्य प्रमाण अपलोड करें",
      link_upload_sub: "UPI स्क्रीनशॉट या बिजली/पानी का बिल — केवल अगर आप चाहें।",
    },
  };
  let currentLang = "en";
  function applyLang(lang) {
    currentLang = lang;
    $all("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      const en = el.dataset.i18nEn || el.innerHTML;
      if (!el.dataset.i18nEn) el.dataset.i18nEn = en;
      const text = lang === "hi" && I18N.hi[key] ? I18N.hi[key] : el.dataset.i18nEn;
      el.innerHTML = text;
    });
    $("#btn-lang").textContent = lang === "en" ? "ENG | हिंदी" : "हिंदी | ENG";
  }

  function renderStepper() {
    const nav = $("#stepper");
    nav.innerHTML = "";
    STEPS.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.className = "step-tab";
      btn.dataset.step = s.id;
      btn.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span> ${s.label}`;
      btn.onclick = () => $("#screen-" + s.id).scrollIntoView({ behavior: "smooth", block: "start" });
      nav.appendChild(btn);
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = e.target.id.replace("screen-", "");
            $all(".step-tab").forEach((t) => t.classList.toggle("active", t.dataset.step === id));
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    STEPS.forEach((s) => {
      const el = $("#screen-" + s.id);
      if (el) observer.observe(el);
    });
  }

  function renderAuditLog() {
    const box = $("#audit-log");
    box.innerHTML = state.auditLog
      .map((e) => `<div class="audit-item"><span class="time">${e.time}</span><span>${e.msg}</span></div>`)
      .join("") || `<div class="empty-state" style="padding:16px;">No events yet.</div>`;
  }

  function renderLandingFlow() {
    const nodes = ["Worker profile", "Verification", "TrustScore", "Starter loan", "Repayment", "Future credit"];
    $("#hero-flow").innerHTML = nodes
      .map((n, i) => `<span class="flow-node">${n}</span>` + (i < nodes.length - 1 ? `<span class="flow-arrow">→</span>` : ""))
      .join("");
  }

  function renderWorkerGrid() {
    const grid = $("#worker-grid");
    grid.innerHTML = WORKERS.map((w) => `
      <button class="worker-card ${state.worker.id === w.id ? "selected" : ""}" data-worker="${w.id}">
        <div class="tag">${w.tag}</div>
        <h3>${w.name}</h3>
        <div class="id">${w.id} · ${w.platform}</div>
        <div class="metric-row" style="border:none;padding-top:10px;">
          <span class="label">Monthly income</span><span class="value">${fmt(w.monthlyIncome)}</span>
        </div>
      </button>
    `).join("");
    $all("[data-worker]", grid).forEach((btn) => (btn.onclick = () => selectWorker(WORKERS.find((w) => w.id === btn.dataset.worker))));
  }

  function renderWorkerDetail() {
    const detail = $("#worker-detail");
    const w = state.worker;
    const s = w.signals;
    const rows = [
      ["Tenure", s.tenureMonths + " months", "verified"],
      ["Platform rating", s.platformRating.toFixed(1) + " / 5", "verified"],
      ["Completion rate", s.completionRate + "%", "verified"],
      ["Cancellation rate", s.cancellationRate + "%", "verified"],
      ["Work consistency", s.workConsistency + "%", "verified"],
      ["Monthly income", fmt(w.monthlyIncome), "consent"],
      ["Income stability (CV)", s.earningsVolatility.toFixed(2), "consent"],
      ["Off-platform payment reliability", s.paymentReliability + "%", "consent"],
      ["UPI regularity", s.upiRegularity + "%", "consent"],
      ["Savings behaviour", s.savingsBehaviour + "%", "consent"],
      ["Income diversification", s.incomeDiversification + "% secondary", "consent"],
      ["Work availability consistency", s.workAvailability + "%", "consent"],
      ["Vehicle / asset", s.vehicleAsset, "supporting"],
    ];
    detail.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;">${w.name} — data profile</h3>
        ${rows.map(([l, v, badge]) => `
          <div class="metric-row">
            <span class="label">${l}</span>
            <span style="display:flex;gap:10px;align-items:center;">
              <span class="value">${v}</span>
              <span class="badge ${badge}">${badge.toUpperCase()}</span>
            </span>
          </div>`).join("")}
      </div>
    `;
  }

  const CUSTOM_FIELDS = [
    { key: "workConsistency", label: "Work consistency (%)", def: 80 },
    { key: "platformRating", label: "Platform rating (1-5)", def: 4.5 },
    { key: "completionRate", label: "Completion rate (%)", def: 90 },
    { key: "earningsVolatility", label: "Income volatility (CV, 0-1)", def: 0.25 },
    { key: "tenureMonths", label: "Tenure (months)", def: 12 },
    { key: "paymentReliability", label: "Payment reliability (%)", def: 80 },
    { key: "cancellationRate", label: "Cancellation rate (%)", def: 6 },
    { key: "upiRegularity", label: "UPI regularity (%)", def: 75 },
    { key: "savingsBehaviour", label: "Savings behaviour (%)", def: 55 },
    { key: "incomeDiversification", label: "Secondary income (% of total)", def: 5 },
    { key: "workAvailability", label: "Availability consistency (%)", def: 70 },
  ];

  function renderCustomForm() {
    $("#custom-fields").innerHTML = CUSTOM_FIELDS.map((f) => `
      <div class="field"><label>${f.label}</label><input type="number" step="any" id="cf-${f.key}" value="${f.def}"></div>
    `).join("") + `
      <div class="field"><label>Vehicle / asset</label>
        <select id="cf-vehicleAsset">
          <option value="none">None</option>
          <option value="financed">Financed</option>
          <option value="owned">Owned</option>
        </select>
      </div>`;
    $("#btn-score-custom").onclick = async () => {
      const signals = {};
      CUSTOM_FIELDS.forEach((f) => (signals[f.key] = parseFloat($("#cf-" + f.key).value)));
      signals.vehicleAsset = $("#cf-vehicleAsset").value;
      const name = $("#cf-name").value || "Custom Worker";
      const income = parseFloat($("#cf-income").value) || 0;
      const customWorker = { id: "CUSTOM", name, tag: "Custom entry", platform: "User-entered mock data", monthlyIncome: income, signals };
      await selectWorker(customWorker);
      $("#screen-score").scrollIntoView({ behavior: "smooth" });
    };
  }

  async function selectWorker(w) {
    state.worker = w;
    state.attestation = "PENDING";
    state.repayment = { state: "NO_HISTORY", performance: 15, outstanding: 0 };
    state.ladderStage = 1;
    state.escalationIndex = -1;
    state.recoveryTriggered = false;
    log(`Worker selected: ${w.name} (${w.id})`);
    renderWorkerGrid();
    renderWorkerDetail();
    renderVerifyScreen();
    await refreshScoreAndLoan();
    renderRepayScreen();
    renderLadderScreen();
    renderRecoveryScreen();
  }

  function renderVerifyScreen() {
    const steps = [
      { t: "Data received", d: "Worker profile loaded" },
      { t: "Claim created", d: "Signal snapshot hashed for attestation" },
      { t: "Signature check", d: "Checking signer ID against authorized list" },
      { t: "Authorized signer", d: state.attestation === "PENDING" ? "Pending submission" : state.attestation === "AUTHORIZED" ? "Signer authorized" : "Signer not authorized" },
      { t: "Attestation " + (state.attestation === "AUTHORIZED" ? "accepted" : state.attestation === "REJECTED" ? "rejected" : "pending"), d: "" },
    ];
    const doneCount = state.attestation === "PENDING" ? 3 : 5;
    $("#verify-timeline").innerHTML = steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      const failed = state.attestation === "REJECTED" && i >= 3;
      const done = i < doneCount;
      return `
        <div class="tl-step">
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div class="tl-dot ${failed ? "fail" : done ? "done" : ""}">${failed ? "✕" : done ? "✓" : ""}</div>
            ${!isLast ? '<div class="tl-line"></div>' : ""}
          </div>
          <div class="tl-content"><div class="t">${s.t}</div><div class="d">${s.d}</div></div>
        </div>`;
    }).join("");
    $("#verify-status").innerHTML = state.attestation === "AUTHORIZED"
      ? `<div class="badge verified">✓ AUTHORIZED — ATTESTATION ACCEPTED</div>`
      : state.attestation === "REJECTED"
      ? `<div class="badge danger">✕ UNAUTHORIZED — ATTESTATION REJECTED</div>`
      : `<div class="badge simulated">Awaiting submission</div>`;
  }

  async function submitAttestation(authorized) {
    const res = await api("/api/verification/attest", {
      workerId: state.worker.id,
      signerId: authorized ? "trustscore-verification-service" : "unrecognized-address",
    });
    state.attestation = res.status;
    log(res.accepted ? "Attestation submitted by authorized signer — accepted" : "Attestation submitted by unauthorized signer — rejected");
    toast(res.accepted ? "Attestation accepted." : "Attestation rejected — unauthorized signer.", res.accepted ? "success" : "error");
    renderVerifyScreen();
  }

  async function refreshScoreAndLoan() {
    $("#score-summary").innerHTML = `<span class="loading">Calling /api/trust-score/calculate…</span>`;
    try {
      const r = await api("/api/trust-score/calculate", { signals: state.worker.signals });
      state.trustScoreResult = r;
      renderScoreScreen();
      const loan = await api("/api/loan/create", { band: r.band, monthlyIncome: state.worker.monthlyIncome });
      state.loan = { ...loan, status: loan.eligible ? "OFFERED" : "NOT_ELIGIBLE" };
      renderCompareScreen();
      renderLoanScreen();
    } catch (e) {
      $("#score-summary").textContent = "Could not load score — see toast for details.";
    }
  }

  function renderScoreScreen() {
    const r = state.trustScoreResult;
    if (!r) return;
    const circumference = 2 * Math.PI * 94;
    const offset = circumference - (r.total / 100) * circumference;
    const fillEl = $("#radial-fill");
    fillEl.style.strokeDasharray = circumference;
    fillEl.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => { fillEl.style.strokeDashoffset = offset; });
    animateCountUp($("#score-num"), r.total);
    const bandColor = { STRONG: "emerald", STANDARD: "cyan", STARTER: "amber", DECLINED: "red" }[r.band];
    $("#band-chip").innerHTML = `<span class="band-chip" style="background:rgba(0,0,0,0.2);color:var(--${bandColor});border:1px solid var(--${bandColor});">${r.band} — ${r.bandLabel}</span>`;
    $("#score-summary").textContent = `${state.worker.name}'s TrustScore, calculated live by the scoring API. Same input always gives this same result.`;

    const sorted = [...r.breakdown].sort((a, b) => b.maxPoints - a.maxPoints);
    $("#all-signals").innerHTML = sorted.map((s) => `
      <div class="signal-bar-row">
        <div class="top">
          <span class="label">${s.label}</span>
          <span class="mono">${s.awardedPoints.toFixed(1)} / ${s.maxPoints}</span>
        </div>
        <div class="signal-bar-track"><div class="signal-bar-fill core" data-target="${(s.awardedPoints / s.maxPoints) * 100}"></div></div>
      </div>`).join("");
    setTimeout(() => $all(".signal-bar-fill").forEach((el) => (el.style.width = el.dataset.target + "%")), 80);

    $("#btn-why").onclick = () => {
      const panel = $("#explain-panel");
      panel.style.display = panel.style.display === "none" || !panel.style.display ? "block" : "none";
      const positives = r.breakdown.filter((s) => s.normalized >= 80);
      const weak = r.breakdown.filter((s) => s.normalized < 60);
      $("#explain-content").innerHTML = `
        <p style="font-weight:600;">Doing well</p>
        <ul class="explain-list">${positives.map((p) => `<li><span style="color:var(--emerald);">+</span> ${p.label}: ${p.raw}</li>`).join("") || "<li>Nothing above 80% this cycle.</li>"}</ul>
        <p style="font-weight:600;">Weaker areas</p>
        <ul class="explain-list">${weak.map((p) => `<li><span style="color:var(--amber);">△</span> ${p.label}: ${p.raw}</li>`).join("") || "<li>Nothing below 60% this cycle.</li>"}</ul>
      `;
    };
  }

  function animateCountUp(el, target) {
    const dur = 1100;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(p * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderCompareScreen() {
    const w = state.worker, r = state.trustScoreResult;
    if (!r) return;
    $("#vs-traditional").innerHTML = `
      <div class="metric-row"><span class="label">Income</span><span class="value">${fmt(w.monthlyIncome)}/month</span></div>
      <div class="metric-row"><span class="label">Payslip</span><span class="value" style="color:var(--red);">Not available</span></div>
      <div class="metric-row"><span class="label">Fixed employer</span><span class="value" style="color:var(--red);">Not available</span></div>
      <div class="metric-row"><span class="label">ITR</span><span class="value" style="color:var(--red);">Not available</span></div>
      <div class="result-chip reject">REJECTED / HIGH-RISK</div>
    `;
    const eligible = r.band !== "DECLINED";
    $("#vs-trust").innerHTML = `
      <div class="metric-row"><span class="label">Work behaviour</span><span class="value badge verified">Verified</span></div>
      <div class="metric-row"><span class="label">Payment behaviour</span><span class="value badge consent">Consent-based</span></div>
      <div class="metric-row"><span class="label">TrustScore</span><span class="value mono">${r.total} / 100</span></div>
      <div class="result-chip ${eligible ? "accept" : "reject"}">${eligible ? "STARTER CREDIT ELIGIBLE" : "NOT YET ELIGIBLE"}</div>
    `;
  }

  function renderLoanScreen() {
    const r = state.trustScoreResult, loan = state.loan;
    if (!r || !loan) return;
    $("#loan-headline").textContent = loan.status === "NOT_ELIGIBLE" ? "Not yet eligible for starter credit" : "Your trust profile qualifies for starter credit";
    $("#loan-stats").innerHTML = `
      <div class="loan-stat"><div class="l">TrustScore</div><div class="v">${r.total} / 100</div></div>
      <div class="loan-stat"><div class="l">Repayment Performance</div><div class="v">${state.repayment.performance} / 15</div></div>
      <div class="loan-stat"><div class="l">Recommended starter exposure</div><div class="v">${fmt(loan.amount)}</div></div>
      <div class="loan-stat"><div class="l">Estimated repayment</div><div class="v">${fmt(loan.repaymentTotal)}</div></div>
      <div class="loan-stat"><div class="l">Target</div><div class="v">${loan.targetDays} days</div></div>
      <div class="loan-stat"><div class="l">Buffer</div><div class="v">+${loan.bufferDays} days</div></div>
    `;
    const btn = $("#btn-accept-loan");
    btn.disabled = !loan.eligible;
    btn.textContent = loan.status === "ACTIVE" ? "Loan active" : loan.eligible ? "Accept simulated loan" : "Not eligible — improve signals first";
    btn.onclick = () => {
      state.loan.status = "ACTIVE";
      state.repayment.outstanding = loan.repaymentTotal;
      log(`Starter loan generated and activated: ${fmt(loan.amount)}`);
      toast("Simulated loan activated.", "success");
      renderLoanScreen();
    };
  }

  function renderRepayScreen() {
    $("#rail-flow").innerHTML = `
      <div class="rail-box"><div class="l" style="color:var(--text-muted);font-size:12px;">Incoming payout</div><div class="amt" id="rail-income">—</div></div>
      <div class="rail-arrow-v">↓</div>
      <div class="rail-box"><div class="l" style="color:var(--text-muted);font-size:12px;">Repayment allocation</div><div class="amt" id="rail-alloc">—</div></div>
      <div class="rail-arrow-v">↓</div>
      <div class="rail-box"><div class="l" style="color:var(--text-muted);font-size:12px;">Available to worker</div><div class="amt" id="rail-avail">—</div></div>
    `;
    $("#repay-timeline").innerHTML = `
      <div class="metric-row"><span class="label">Day 0</span><span class="value">Loan started</span></div>
      <div class="metric-row"><span class="label">Day 30</span><span class="value">Normal repayment target</span></div>
      <div class="metric-row"><span class="label">Day 30–45</span><span class="value">Income-instability buffer</span></div>
      <div class="metric-row"><span class="label">Day 45</span><span class="value">10% recovery if unpaid</span></div>
    `;
    updateRepayStats();
    $("#btn-simulate-income").onclick = async () => {
      const r = await api("/api/repayment/simulate-income", {});
      $("#rail-income").textContent = fmt(r.income);
      $("#rail-alloc").textContent = fmt(r.allocation);
      $("#rail-avail").textContent = fmt(r.available);
      log(`Income simulated: ${fmt(r.income)} → repayment allocation ${fmt(r.allocation)}`);
      toast("Payment recorded.", "success");
    };
    $("#btn-day30-ontime").onclick = () => setRepaymentState("ON_TIME");
    $("#btn-day30-minor").onclick = () => setRepaymentState("MINOR_DELAY");
    $("#btn-day45-missed").onclick = () => setRepaymentState("OVERDUE");
  }

  function updateRepayStats() {
    $("#repay-perf").textContent = state.repayment.performance + " / 15";
    $("#repay-state").textContent = state.repayment.state;
  }

  async function setRepaymentState(key) {
    const s = await api("/api/repayment/record", { state: key });
    state.repayment.state = key;
    state.repayment.performance = s.score;
    log(`Repayment recorded — ${s.label}. Repayment Performance updated to ${s.score}/15.`);
    updateRepayStats();
    if (key === "ON_TIME") { state.ladderStage = Math.max(state.ladderStage, 3); toast("On-time repayment recorded. Ladder advanced.", "success"); }
    if (key === "MINOR_DELAY") { state.ladderStage = Math.max(state.ladderStage, 2); toast("Minor delay recorded — small reduction.", ""); }
    if (key === "OVERDUE") {
      state.ladderStage = 5;
      state.escalationIndex = 1;
      toast("Repayment overdue past buffer.", "error");
    }
    renderLadderScreen();
    renderRecoveryScreen();
  }

  const LADDER_DEFS = [
    { n: 1, t: "First loan", d: () => `TrustScore ${state.trustScoreResult?.total ?? "—"} · Repayment Performance 15/15 · Starter exposure` },
    { n: 2, t: "Successful repayment", d: () => "Evidence strengthens" },
    { n: 3, t: "Several successful cycles", d: () => "Higher future eligibility" },
    { n: 4, t: "Missed / late cycle", d: () => "Repayment Performance falls, growth slows" },
    { n: 5, t: "Recovery trigger", d: () => "No repayment by day 45 — 10% recovery mechanism" },
  ];
  function renderLadderScreen() {
    $("#ladder-list").innerHTML = LADDER_DEFS.map((l) => {
      const risk = l.n === 4 || l.n === 5;
      const cls = l.n < state.ladderStage ? "done" : l.n === state.ladderStage ? "active" : "";
      return `
      <div class="ladder-stage ${cls} ${risk && l.n <= state.ladderStage ? "risk" : ""}">
        <div class="ladder-num">${l.n}</div>
        <div><div style="font-weight:700;">${l.t}</div><div style="color:var(--text-muted);font-size:13px;">${l.d()}</div></div>
      </div>`;
    }).join("");
  }

  const ESCALATION_STAGES = ["FLAGGED", "REDUCE", "RESTRICT", "NO_CREDIT", "LEGAL_ACTION"];
  function renderRecoveryScreen() {
    $("#escalation-list").innerHTML = ESCALATION_STAGES.map((s, i) => `
      <div class="esc-step ${i === state.escalationIndex ? "active" : i < state.escalationIndex ? "passed" : ""}">${s.replace("_", " ")}</div>
    `).join("");
    const outstanding = state.repayment.outstanding || 0;
    $("#recovery-panel").innerHTML = state.recoveryTriggered
      ? `<div class="metric-row"><span class="label">Status</span><span class="value badge danger">Recovery already triggered</span></div>`
      : `<div class="metric-row"><span class="label">Outstanding</span><span class="value">${fmt(outstanding)}</span></div>
         <div class="metric-row"><span class="label">Recovery rate</span><span class="value">10%</span></div>`;
    $("#btn-trigger-recovery").disabled = state.recoveryTriggered || outstanding <= 0;
    $("#btn-trigger-recovery").onclick = async () => {
      try {
        const res = await api("/api/recovery/trigger", { outstanding, alreadyTriggered: state.recoveryTriggered });
        state.recoveryTriggered = true;
        state.repayment.outstanding = res.remaining;
        state.escalationIndex = 2;
        log(`Day-45 recovery triggered: ${fmt(res.recoveryAmount)} deducted. Remaining: ${fmt(res.remaining)}`);
        toast(`Recovery applied: ${fmt(res.recoveryAmount)}`, "success");
        renderRecoveryScreen();
      } catch (e) { /* toast already shown by api() */ }
    };
    $("#btn-rehabilitate").onclick = async () => {
      const s = await api("/api/repayment/record", { state: "RECOVERED" });
      state.repayment.state = "RECOVERED";
      state.repayment.performance = s.score;
      state.escalationIndex = -1;
      state.ladderStage = 3;
      log("Resumed repayment recorded — worker entering rehabilitation.");
      $("#rehab-status").innerHTML = `<div class="badge verified">Rehabilitation in progress — Repayment Performance ${state.repayment.performance}/15</div>`;
      toast("Rehabilitation started.", "success");
      renderRecoveryScreen();
      renderLadderScreen();
    };
  }

  function renderMethodology() {
    const meta = [
      ["Work Consistency", 15], ["Platform Rating", 12], ["Completion Rate", 12],
      ["Income Stability", 12], ["Platform Tenure", 10], ["Payment Reliability", 10],
      ["Cancellation Rate", 8], ["UPI Transaction Regularity", 6], ["Savings Behaviour", 5],
      ["Income Diversification", 4], ["Work Availability Consistency", 3], ["Vehicle / Asset Ownership", 3],
    ];
    $("#methodology-table").innerHTML = meta.map(([label, pts], i) => `
      <tr><td class="mono">${i + 1}</td><td>${label}</td><td class="mono">${pts}</td></tr>
    `).join("") + `<tr><td></td><td style="font-weight:700;">Total</td><td class="mono" style="font-weight:700;">100</td></tr>`;
  }

  async function runDemoMode() {
    toast("Running hackathon demo…", "");
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await selectWorker(WORKERS[0]);
    $("#screen-worker").scrollIntoView({ behavior: "smooth" }); await wait(900);
    $("#screen-verify").scrollIntoView({ behavior: "smooth" }); await wait(700);
    await submitAttestation(true); await wait(900);
    $("#screen-score").scrollIntoView({ behavior: "smooth" }); await wait(1800);
    $("#screen-compare").scrollIntoView({ behavior: "smooth" }); await wait(1200);
    $("#screen-loan").scrollIntoView({ behavior: "smooth" }); await wait(900);
    $("#btn-accept-loan").click(); await wait(900);
    $("#screen-repay").scrollIntoView({ behavior: "smooth" }); await wait(800);
    $("#btn-simulate-income").click(); await wait(800);
    await setRepaymentState("ON_TIME"); await wait(600);
    $("#screen-ladder").scrollIntoView({ behavior: "smooth" }); await wait(1000);
    toast("Demo complete. Scroll to Recovery & Methodology anytime.", "success");
  }

  async function resetDemo() {
    await selectWorker(WORKERS[0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Demo reset.", "");
    log("Demo reset — worker and repayment state cleared.");
  }

  async function init() {
    renderLandingFlow();
    renderStepper();
    renderAuditLog();
    renderMethodology();
    renderCustomForm();
    applyLang("en");
    $("#btn-lang").onclick = () => applyLang(currentLang === "en" ? "hi" : "en");
    $("#btn-mock-link").onclick = () => {
      $("#mock-link-status").innerHTML = `<div class="badge verified">✓ Platform linked (mock) — signed data received</div>`;
      log("Mock: platform data linked (signed, no real API call).");
    };
    $("#mock-file-input").onchange = (e) => {
      const name = e.target.files[0]?.name;
      if (name) {
        $("#mock-link-status").innerHTML = `<div class="badge consent">✓ ${name} attached (mock — not uploaded anywhere)</div>`;
        log(`Mock: off-platform proof "${name}" attached (not actually uploaded).`);
      }
    };
    $("#btn-verify-authorized").onclick = () => submitAttestation(true);
    $("#btn-verify-unauthorized").onclick = () => submitAttestation(false);
    $("#btn-reset").onclick = () => resetDemo();
    $("#btn-demo-mode").onclick = () => runDemoMode();
    $all("[data-goto]").forEach((el) => (el.onclick = () => $("#screen-" + el.dataset.goto).scrollIntoView({ behavior: "smooth" })));
    await selectWorker(WORKERS[0]);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
