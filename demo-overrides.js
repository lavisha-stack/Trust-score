/*
 * Aegis — demo controls and presentation fixes
 *
 * This file sits on top of app.js. It does not change the scoring engine,
 * API calls, or visual layout. It only fixes demo controls and wording.
 */

(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------------------------------------------------------------------------
  // 1. Presentation helpers
  // ---------------------------------------------------------------------------

  function isHindi() {
    const button = $('#btn-lang');
    return button && button.textContent.trim().startsWith('हिंदी');
  }

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function scrollToScreen(id) {
    const screen = $(`#screen-${id}`);
    if (!screen) return;
    screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function highlightPrototypePolicy() {
    const note = $('#screen-loan .disclaimer');
    if (note) note.classList.add('prototype-policy-highlight');
  }

  function updateRepaymentRailCopy() {
    const hindi = isHindi();
    const title = $('#screen-repay .card h3');
    const badge = $('#screen-repay .badge.simulated');
    const button = $('#btn-simulate-income');

    setText(title, hindi
      ? 'डेमो में payout कैसे बांटा जाता है'
      : 'How the demo payout is split');

    setText(badge, hindi
      ? 'डेमो — असली payout कनेक्शन नहीं है'
      : 'DEMO — no real payout connection');

    setText(button, hindi
      ? '₹3,000 payout आने का डेमो दिखाएं'
      : 'Show a ₹3,000 incoming payout');
  }

  function updateEscalationLanguage() {
    const hindi = isHindi();
    const steps = $$('#escalation-list .esc-step');
    const english = ['FLAGGED', 'REDUCE', 'RESTRICT', 'NO CREDIT', 'LENDER RECOURSE'];
    const hindiLabels = ['FLAGGED', 'सीमा कम करें', 'सीमित करें', 'नया क्रेडिट रोकें', 'LENDER RECOURSE'];

    steps.forEach((step, index) => {
      setText(step, (hindi ? hindiLabels : english)[index] || '');
    });
  }

  function updateRecoveryLanguage() {
    const hindi = isHindi();
    const button = $('#btn-trigger-recovery');
    const heading = $('#screen-recovery .card:nth-of-type(2) h3');
    const badge = $('#screen-recovery .card:nth-of-type(2) .badge');
    const disclaimer = $('#screen-recovery .card:first-of-type .disclaimer');

    setText(heading, hindi
      ? 'दिन 45: बची राशि पर recovery'
      : 'Day 45: recovery from the remaining balance');

    setText(badge, hindi
      ? 'डेमो recovery नीति'
      : 'DEMO RECOVERY POLICY');

    setText(button, hindi
      ? 'बची राशि पर 10% recovery लागू करें'
      : 'Apply 10% recovery to the remaining balance');

    setText(disclaimer, hindi
      ? 'पहले छूटे भुगतान के बाद कार्रवाई धीरे-धीरे बढ़ती है। दोबारा भुगतान शुरू करने पर स्थिति में सुधार की गुंजाइश रहती है।'
      : 'A missed payment moves through gradual steps. Resumed repayment can improve the worker’s position.');
  }

  function refreshPresentationCopy() {
    highlightPrototypePolicy();
    updateRepaymentRailCopy();
    updateEscalationLanguage();
    updateRecoveryLanguage();
  }

  // ---------------------------------------------------------------------------
  // 2. Reliable reset
  // ---------------------------------------------------------------------------
  // The old reset only selected the first worker. If Demo Mode was still
  // running, its timers could continue changing the page after the reset.
  // Reloading gives the prototype a genuinely clean state and cancels the demo.

  function resetDemo() {
    window.location.reload();
  }

  // ---------------------------------------------------------------------------
  // 3. Human-paced hackathon demo
  // ---------------------------------------------------------------------------
  // The demo uses the existing UI buttons, so the real screens and states are
  // shown. Timing is short enough for a hackathon but long enough to read.

  async function runDemo() {
    const demoButton = $('#btn-demo-mode');
    const firstWorker = $('#worker-grid .worker-card');
    const authorize = $('#btn-verify-authorized');
    const acceptLoan = $('#btn-accept-loan');
    const payout = $('#btn-simulate-income');
    const minimumRepayment = $('#btn-day30-ontime');
    const missedRepayment = $('#btn-day45-missed');
    const recovery = $('#btn-trigger-recovery');

    if (!firstWorker || !authorize || !acceptLoan || !payout || !minimumRepayment) return;

    demoButton?.setAttribute('disabled', 'disabled');
    setText(demoButton, isHindi() ? 'डेमो चल रहा है…' : 'Demo running…');

    const show = async (id, duration) => {
      scrollToScreen(id);
      await wait(duration);
    };

    try {
      // 1. Worker selection and score generation.
      firstWorker.click();
      await show('worker', 2200);

      // 2. Verification.
      await show('verify', 2200);
      authorize.click();
      await wait(1300);

      // 3. Score.
      await show('score', 3000);

      // 4. Loan offer.
      await show('loan', 2400);
      if (!acceptLoan.disabled) {
        acceptLoan.click();
        await wait(1000);
      }

      // 5. Repayment flow.
      await show('repay', 1800);
      payout.click();
      await wait(1800);
      minimumRepayment.click();
      await wait(1800);

      // 6. Repayment ladder.
      await show('ladder', 2200);

      // 7. Missed payment and recovery.
      if (missedRepayment) {
        missedRepayment.click();
        await wait(800);
      }
      await show('recovery', 2500);
      if (recovery && !recovery.disabled) {
        recovery.click();
        await wait(1800);
      }

      // 8. Finish on methodology so judges see the transparent model.
      await show('methodology', 3200);
    } finally {
      if (demoButton) {
        demoButton.removeAttribute('disabled');
        setText(demoButton, isHindi() ? '▶ हैकाथॉन डेमो मोड' : '▶ Hackathon Demo Mode');
      }
      refreshPresentationCopy();
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Keep requested copy after app.js re-renders a screen.
  // ---------------------------------------------------------------------------

  const observer = new MutationObserver(() => refreshPresentationCopy());

  function init() {
    const resetButton = $('#btn-reset');
    const demoButton = $('#btn-demo-mode');
    const languageButton = $('#btn-lang');

    if (resetButton) resetButton.onclick = resetDemo;
    if (demoButton) demoButton.onclick = runDemo;

    if (languageButton) {
      languageButton.addEventListener('click', () => {
        setTimeout(refreshPresentationCopy, 40);
      });
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    refreshPresentationCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
