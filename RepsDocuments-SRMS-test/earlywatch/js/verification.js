/* ============================================================
   EarlyWatch — Verification Code modal
   Usage: const ok = await ewShowVerificationModal();
   Returns true when the user enters the correct code (12345).
   ============================================================ */
(function () {
  "use strict";

  const VERIFICATION_CODE = "12345";

  function showModal({ title, bodyHTML, footerHTML, width = 460, onClose }) {
    const overlay = document.createElement("div");
    overlay.className = "ew-modal-overlay";
    overlay.innerHTML = `
      <div class="ew-modal" style="max-width:${width}px" role="dialog" aria-modal="true">
        <div class="ew-modal-header">
          <h2>${title}</h2>
          <button type="button" class="ew-modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 style="width:16px;height:16px;">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="ew-modal-body">${bodyHTML}</div>
        <div class="ew-modal-footer">${footerHTML || ""}</div>
      </div>`;

    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();

    let resolveClosed;
    const closed = new Promise(r => { resolveClosed = r; });
    let isClosed = false;

    function close(value) {
      if (isClosed) return;
      isClosed = true;
      overlay.classList.add("closing");
      setTimeout(() => overlay.remove(), 140);
      if (typeof onClose === "function") onClose(value);
      resolveClosed(value);
    }

    overlay.addEventListener("click", e => { if (e.target === overlay) close(null); });
    overlay.querySelector(".ew-modal-close").addEventListener("click", () => close(null));
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { document.removeEventListener("keydown", onKey); close(null); }
    });

    return { overlay, close, closed };
  }

  async function ewShowVerificationModal() {
    const bodyHTML = `
      <form id="ewVerifyForm" novalidate>
        <p class="ew-modal-text" style="margin-bottom:1rem;">
          We sent a 5-digit verification code to your email.
          Enter it below to activate your account.
        </p>
        <div class="ew-form-error" hidden></div>
        <label class="ew-field">
          <span>Verification code</span>
          <input type="text"
                 id="ewVerifyCode"
                 name="code"
                 inputmode="numeric"
                 pattern="[0-9]*"
                 maxlength="5"
                 autocomplete="one-time-code"
                 placeholder="•••••"
                 style="text-align:center;font-size:1.4rem;letter-spacing:.5rem;font-weight:700;">
        </label>
        <p class="ew-modal-text" style="margin-top:.75rem;font-size:.75rem;color:#8b93a0;">
          Didn't get a code? Check your spam folder or resend.
        </p>
      </form>`;

    const footerHTML = `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="resend">Resend</button>
      <button type="button" class="ew-btn ew-btn-primary" data-role="verify">Verify</button>`;

    const { overlay, close, closed } = showModal({
      title: "Verify your account",
      bodyHTML,
      footerHTML,
      width: 460
    });

    const form     = overlay.querySelector("#ewVerifyForm");
    const input    = overlay.querySelector("#ewVerifyCode");
    const errBox   = overlay.querySelector(".ew-form-error");
    const verifyBtn = overlay.querySelector('[data-role="verify"]');
    const resendBtn = overlay.querySelector('[data-role="resend"]');

    // Autofocus + numeric-only filter
    setTimeout(() => input.focus(), 60);
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 5);
    });

    function showError(msg) {
      errBox.textContent = msg;
      errBox.hidden = false;
    }
    function clearError() {
      errBox.hidden = true;
      errBox.textContent = "";
    }

    function attempt() {
      clearError();
      const code = input.value.trim();

      if (code.length !== 5) {
        showError("Please enter the 5-digit code.");
        return;
      }
      if (code !== VERIFICATION_CODE) {
        showError("Incorrect code. Please try again.");
        input.value = "";
        input.focus();
        return;
      }
      // Success
      close(true);
    }

    verifyBtn.onclick = attempt;
    resendBtn.onclick = () => {
      clearError();
      input.value = "";
      input.focus();
      // Tiny UX feedback
      resendBtn.textContent = "Sent ✓";
      setTimeout(() => { resendBtn.textContent = "Resend"; }, 1200);
    };

    form.addEventListener("submit", e => { e.preventDefault(); attempt(); });

    // Enter key inside input
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); attempt(); }
    });

    return closed;
  }

  window.ewShowVerificationModal = ewShowVerificationModal;
})();


