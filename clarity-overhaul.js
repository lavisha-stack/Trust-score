/* Aegis clarity + transparency layer
 * Keeps the scoring engine unchanged while making the borrower-facing language
 * simpler and adding judge-facing explanations for prototype assumptions.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const replacements = new Map([
    ["Money for people banks can't see yet", "Credit that looks beyond traditional paperwork"],
    ["₹28,000 earned.", "₹28,000 earned."],
    ["Still invisible", "Still hard to assess"],
    ["Aegis looks at your work — not your paperwork — to decide if you can get a small loan.", "Aegis adds verified work and payment behaviour to the information a lender can use."],
    ["Pick a worker to see their score", "Choose a worker to see their score"],
    ["Checking the data is real", "Check the data"],
    ["What happens if you can't pay", "If a payment is missed"],
    ["Escalation ladder", "Support and recovery steps"],
    ["Trigger 10% recovery deduction", "Apply the demo recovery step"],
    ["Day-45 recovery mechanism", "Day-45 recovery step"],
    ["Trust rehabilitation", "Getting back on track"],
    ["Why did I get this score?", "Why did my score change?"],
    ["Why this score?", "What changed?"],
    ["Your TrustScore is a 100-point score built from 12 work signals. It shows lenders how reliable your income is — even without a traditional credit history.", "Your TrustScore is a 100-point score based on 12 work and financial signals. It adds information that may be missing from a thin traditional credit history."],
    ["Traditional documentation just doesn't capture this worker's reliability — it's not that banks are bad, they just can't see this kind of income.", "Traditional documents may not show the full picture of a gig worker's income and work history. TrustScore adds verified behavioural signals to that picture."],
    ["Aegis looks at your work — not your paperwork — to decide if you can get a small loan.", "Aegis adds verified work and payment behaviour to the information a lender can use."],
    ["Prototype policy. This shows how your TrustScore maps to a loan cap (as a percentage of your monthly income) and an annual rate.", "Prototype policy. The score is mapped to a loan cap and an indicative annual rate. These numbers are assumptions for this demo, not validated lending rules."],
    ["All exact score movements, loan amounts and recovery percentages are prototype policy choices for this hackathon and are not empirically validated lending rules.", "All score weights, loan limits, rates and recovery percentages are prototype choices. In production, they would be tested against repayment data and reviewed for fairness."],
    ["The first missed payment does not trigger legal action. Escalation is gradual, and rehabilitation is always possible through resumed repayment.", "A missed payment starts with a review and support steps. The demo uses gradual recovery, and resumed repayment can improve the borrower's position."],
  ]);

  function replaceText(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if (!n.parentElement || ['SCRIPT','STYLE'].includes(n.parentElement.tagName)) return;
      let text = n.nodeValue;
      replacements.forEach((to, from) => { if (text.includes(from)) text = text.split(from).join(to); });
      n.nodeValue = text;
    });
  }

  function addScoreChangeCard() {
    const scoreCard = $('.score-hero');
    if (!scoreCard || $('#score-change-card')) return;
    const card = document.createElement('div');
    card.id = 'score-change-card';
    card.className = 'card explain-box';
    card.style.marginTop = '20px';
    card.innerHTML = `
      <h3 style="margin-top:0;">Why did my score change?</h3>
      <p style="color:var(--text-muted);margin-top:0;">The score should be explainable, not a black box. When a worker's data changes, the app can show which signals moved the score.</p>
      <div class="metric-row"><span class="label">TrustScore</span><span class="value mono">78 → 83</span></div>
      <div class="explain-list" style="margin-top:10px;">
        <div>+3&nbsp; Consistent income</div>
        <div>+2&nbsp; Successful repayments</div>
        <div>+1&nbsp; Improved completion rate</div>
        <div>−1&nbsp; Higher cancellation rate</div>
      </div>
      <div class="disclaimer" style="margin-top:12px;">Example only. The production version would calculate these changes from the worker's previous verified score and current data.</div>`;
    scoreCard.parentElement.insertBefore(card, scoreCard.nextSibling);
  }

  function addMethodologyExplanation() {
    const method = $('#screen-methodology');
    if (!method || $('#weight-explanation')) return;
    const card = document.createElement('div');
    card.id = 'weight-explanation';
    card.className = 'card';
    card.style.marginTop = '16px';
    card.innerHTML = `
      <h3 style="margin-top:0;">Why these weights?</h3>
      <p style="color:var(--text-muted);margin-bottom:10px;">These are prototype weights based on how reliable and relevant we expect each signal to be for repayment. We use a simple, transparent model for the hackathon so every point can be explained.</p>
      <p style="color:var(--text-muted);margin-bottom:0;">We are not claiming that 15 points for consistency or 3 points for asset ownership has been statistically proven to predict default. In production, the weights would be calibrated using historical repayment/default data and tested for bias.</p>`;
    method.insertBefore(card, method.querySelector('.disclaimer'));

    const policy = document.createElement('div');
    policy.className = 'card';
    policy.style.marginTop = '16px';
    policy.innerHTML = `
      <h3 style="margin-top:0;">How we set the prototype rates</h3>
      <p style="color:var(--text-muted);margin-bottom:10px;">The rates shown here are illustrative. They are informed by real Indian personal-loan pricing, but they are not an estimate of the worker's true default risk.</p>
      <p style="color:var(--text-muted);margin-bottom:10px;">SBI currently publishes personal-loan rates starting at 10.05% p.a., while ICICI's credit-card personal-loan product lists 13%–16% depending on eligibility. These products are not direct comparables to gig-worker lending.</p>
      <p style="color:var(--text-muted);margin-bottom:0;">RBI guidance says lenders' pricing should consider factors such as cost of funds, margin and risk premium, and that the approach to risk-based pricing should be transparent. Our production version would therefore calibrate rates from actual portfolio performance rather than treating these demo rates as “optimal”.</p>`;
    method.insertBefore(policy, method.querySelector('.disclaimer'));
  }

  function simplifyRecoverySteps() {
    const labels = {
      'FLAGGED': 'REVIEW',
      'REDUCE': 'SUPPORT',
      'RESTRICT': 'LIMIT',
      'NO_CREDIT': 'PAUSE NEW CREDIT',
      'LEGAL_ACTION': 'FORMAL RECOVERY'
    };
    $$('.esc-step').forEach(el => {
      const key = el.textContent.trim().replace(/\s+/g, '_');
      if (labels[key]) el.textContent = labels[key];
    });
    const ladder = $('#escalation-list');
    if (ladder && !$('#recovery-note')) {
      const note = document.createElement('div');
      note.id = 'recovery-note';
      note.className = 'disclaimer';
      note.style.marginTop = '12px';
      note.innerHTML = '<b>Borrower-first demo:</b> the first response is review and support. Formal recovery is a later step, subject to the lender\'s legal and compliance requirements.';
      ladder.parentElement.appendChild(note);
    }
  }

  function updateDynamicLabels() {
    simplifyRecoverySteps();
    const rateCells = $$('#band-policy-table td:last-child');
    rateCells.forEach(cell => {
      const t = cell.textContent.trim();
      if (t && t !== '—' && !t.includes('illustrative')) cell.textContent = t + ' · illustrative';
    });
    const recoveryBtn = $('#btn-trigger-recovery');
    if (recoveryBtn) recoveryBtn.textContent = 'Apply the demo recovery step';
  }

  function run() {
    replaceText();
    addScoreChangeCard();
    addMethodologyExplanation();
    updateDynamicLabels();
    setTimeout(() => { replaceText(); updateDynamicLabels(); }, 100);
  }

  document.addEventListener('DOMContentLoaded', run);
  const observer = new MutationObserver(() => {
    clearTimeout(window.__aegisClarityTimer);
    window.__aegisClarityTimer = setTimeout(() => { replaceText(); updateDynamicLabels(); }, 40);
  });
  window.addEventListener('load', () => {
    run();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
