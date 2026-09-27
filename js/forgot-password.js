/* ============================================================
   EarlyWatch — Forgot Password flow (frontend-only, simulated)
   Three-step modal: email → reset code → new password
   Depends on: db.js, auth.js, app.js (for ewShowModal)
   ============================================================ */

(function () {
  "use strict";

  const RESET_CODE = "reset123";
  const RESET_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes for the code itself
  const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between resend clicks

  let _flowRunning = false;

  /* ------------------------------------------------------------
     Step 1 — Ask for the account email
     ------------------------------------------------------------ */
  function showEmailStep() {
    const bodyHTML = `
      <form id="ewForgotEmailForm" novalidate>
        <p class="ew-modal-text" style="margin-bottom:1rem;">
          Enter the email address associated with your EarlyWatch account
          and we'll send you a reset code.
        </p>
        <div class="ew-form-error" hidden></div>
        <label class="ew-field">
          <span>Email address</span>
          <input type="email" name="email" placeholder="you@cmdi.edu.ph"
                 autocomplete="email" required>
        </label>
      </form>`;

    const footerHTML = `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
      <button type="button" class="ew-btn ew-btn-primary" data-role="send">Send reset code</button>`;

    const { overlay, close, closed } = ewShowModal({
      title: "Forgot password",
      bodyHTML,
      footerHTML,
      width: 460,
    });

    const form = overlay.querySelector("#ewForgotEmailForm");
    const errBox = overlay.querySelector(".ew-form-error");
    const sendBtn = overlay.querySelector('[data-role="send"]');
    const cancelBtn = overlay.querySelector('[data-role="cancel"]');
    const input = form.elements["email"];

    setTimeout(() => input.focus(), 40);

    const showError = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = false;
    };
    const clearError = () => {
      errBox.hidden = true;
      errBox.textContent = "";
    };

    cancelBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      close(null);
    });

    async function submit() {
      clearError();
      const email = input.value.trim();

      if (!email) {
        showError("Please enter your email address.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("Please enter a valid email address.");
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = "Sending…";

      await new Promise((r) => setTimeout(r, 550));

      sessionStorage.setItem(
        "earlywatch.resetSession",
        JSON.stringify({
          email: email.toLowerCase(),
          code: RESET_CODE,
          issuedAt: Date.now(),
          lastResentAt: 0,
        }),
      );

      close({ email: email.toLowerCase() });
    }

    sendBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit();
    });

    return closed;
  }

  /* ------------------------------------------------------------
     Step 2 — Enter the reset code (with Resend)
     ------------------------------------------------------------ */
  function showCodeStep(email) {
    const bodyHTML = `
      <form id="ewForgotCodeForm" novalidate>
        <p class="ew-modal-text" style="margin-bottom:1rem;">
          We sent a reset code to <strong>${ewEsc(email)}</strong>.
          Enter it below to continue.
        </p>
        <div class="ew-form-error" hidden></div>
        <label class="ew-field">
          <span>Reset code</span>
          <input type="text" name="code" placeholder="reset123"
                 autocomplete="one-time-code" required>
        </label>

        <!-- Resend row -->
        <div class="ew-resend-row">
          <span class="ew-resend-text">Didn't receive the code?</span>
          <button type="button" class="ew-resend-btn" data-role="resend">
            Resend code
          </button>
        </div>

        <p class="ew-modal-text" style="margin-top:.75rem;font-size:.72rem;color:#8b93a0;">
  Demo mode — your code is
  <code style="background:#1b2130;padding:1px 5px;border-radius:3px;">${(readSession() && readSession().code) || "—"}</code>.
</p>
      </form>`;

    const footerHTML = `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="back">Back</button>
      <button type="button" class="ew-btn ew-btn-primary" data-role="verify">Verify code</button>`;

    const { overlay, close, closed } = ewShowModal({
      title: "Enter reset code",
      bodyHTML,
      footerHTML,
      width: 460,
    });

    const form = overlay.querySelector("#ewForgotCodeForm");
    const errBox = overlay.querySelector(".ew-form-error");
    const verifyBtn = overlay.querySelector('[data-role="verify"]');
    const backBtn = overlay.querySelector('[data-role="back"]');
    const resendBtn = overlay.querySelector('[data-role="resend"]');
    const input = form.elements["code"];

    setTimeout(() => input.focus(), 40);

    const showError = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = false;
    };
    const clearError = () => {
      errBox.hidden = true;
      errBox.textContent = "";
    };

    /* ----- Resend logic ----- */
    let resendCooldownTimer = null;
    let resendCooldownEnd = 0;

    function startResendCooldown() {
      resendCooldownEnd = Date.now() + RESEND_COOLDOWN_MS;
      resendBtn.disabled = true;
      resendBtn.classList.add("is-cooling");

      function tick() {
        const remaining = Math.max(
          0,
          Math.ceil((resendCooldownEnd - Date.now()) / 1000),
        );
        if (remaining <= 0) {
          resendBtn.disabled = false;
          resendBtn.classList.remove("is-cooling");
          resendBtn.textContent = "Resend code";
          resendCooldownTimer = null;
          return;
        }
        resendBtn.textContent = `Resend in ${remaining}s`;
        resendCooldownTimer = setTimeout(tick, 250);
      }
      tick();
    }

    function readSession() {
      try {
        return JSON.parse(
          sessionStorage.getItem("earlywatch.resetSession") || "null",
        );
      } catch (_) {
        return null;
      }
    }

    resendBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (resendBtn.disabled) return;

      clearError();

      const session = readSession();
      if (!session || session.email !== email) {
        showError("This reset session has expired. Please start again.");
        return;
      }

      // Simulate sending a new code
      resendBtn.disabled = true;
      resendBtn.textContent = "Sending…";
      await new Promise((r) => setTimeout(r, 500));

      // Refresh the session: new code, new TTL, record the resend time
      session.code = RESET_CODE;
      session.issuedAt = Date.now();
      session.lastResentAt = Date.now();
      sessionStorage.setItem(
        "earlywatch.resetSession",
        JSON.stringify(session),
      );

      // UI feedback
      resendBtn.textContent = "Sent ✓";
      resendBtn.classList.add("is-sent");
      input.value = "";
      input.focus();

      setTimeout(() => {
        resendBtn.classList.remove("is-sent");
        startResendCooldown();
      }, 900);
    });

    /* ----- Verify ----- */
    function verify() {
      clearError();
      const code = input.value.trim();

      if (!code) {
        showError("Please enter the reset code.");
        return;
      }

      const session = readSession();

      if (!session || session.email !== email) {
        showError("This reset session has expired. Please start again.");
        return;
      }
      if (Date.now() - session.issuedAt > RESET_CODE_TTL_MS) {
        showError("This reset code has expired. Please request a new one.");
        return;
      }
      if (code !== session.code) {
        showError("Incorrect reset code. Please try again.");
        input.value = "";
        input.focus();
        return;
      }

      close({ email });
    }

    verifyBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      verify();
    });

    backBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      close({ back: true });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      verify();
    });

    /* Clean up the countdown if the modal is dismissed */
    closed.then(() => {
      if (resendCooldownTimer) {
        clearTimeout(resendCooldownTimer);
        resendCooldownTimer = null;
      }
    });

    return closed;
  }

  /* ------------------------------------------------------------
     Step 3 — Choose a new password
     ------------------------------------------------------------ */
  function showPasswordStep(email) {
    const bodyHTML = `
      <form id="ewForgotPasswordForm" novalidate>
        <p class="ew-modal-text" style="margin-bottom:1rem;">
          Choose a new password for <strong>${ewEsc(email)}</strong>.
        </p>
        <div class="ew-form-error" hidden></div>
        <div class="ew-form-grid">
          <label class="ew-field" style="grid-column:1/-1;">
            <span>New password</span>
            <div class="password-wrapper">
              <input type="password" name="password"
                     placeholder="Include a symbol, e.g. MyPass!"
                     autocomplete="new-password" required>
            </div>
          </label>
          <label class="ew-field" style="grid-column:1/-1;">
            <span>Confirm new password</span>
            <div class="password-wrapper">
              <input type="password" name="confirm"
                     placeholder="Re-enter password"
                     autocomplete="new-password" required>
            </div>
          </label>
        </div>
      </form>`;

    const footerHTML = `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
      <button type="button" class="ew-btn ew-btn-primary" data-role="save">Update password</button>`;

    const { overlay, close, closed } = ewShowModal({
      title: "Set a new password",
      bodyHTML,
      footerHTML,
      width: 500,
    });

    const form = overlay.querySelector("#ewForgotPasswordForm");
    const errBox = overlay.querySelector(".ew-form-error");
    const saveBtn = overlay.querySelector('[data-role="save"]');
    const cancelBtn = overlay.querySelector('[data-role="cancel"]');

    if (window.ewWirePasswordToggles) window.ewWirePasswordToggles();

    const passEl = form.elements["password"];
    setTimeout(() => passEl.focus(), 40);

    const showError = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = false;
    };
    const clearError = () => {
      errBox.hidden = true;
      errBox.textContent = "";
    };

    cancelBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      close(null);
    });

    async function save() {
      clearError();
      const password = form.elements["password"].value;
      const confirm = form.elements["confirm"].value;

      if (!password) {
        showError("Please enter a new password.");
        return;
      }
      if (password !== confirm) {
        showError("Passwords do not match.");
        return;
      }

      if (typeof ewValidatePassword === "function") {
        const pwCheck = ewValidatePassword(password);
        if (!pwCheck.ok) {
          showError(pwCheck.errors.join(" "));
          return;
        }
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Updating…";

      const result = EW_DB.users.updatePassword(email, password);

      if (!result.ok) {
        showError(
          (result.errors && result.errors[0]) || "Could not update password.",
        );
        saveBtn.disabled = false;
        saveBtn.textContent = "Update password";
        return;
      }

      sessionStorage.removeItem("earlywatch.resetSession");
      close({ success: true });
    }

    saveBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      save();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      save();
    });

    return closed;
  }

  /* ------------------------------------------------------------
     Orchestrator — runs the three steps in sequence.
     Cancel at any step immediately ends the flow.
     ------------------------------------------------------------ */
  async function startForgotPasswordFlow() {
    if (_flowRunning) return;
    _flowRunning = true;

    try {
      let emailResult = await showEmailStep();

      while (emailResult && emailResult.back) {
        emailResult = await showEmailStep();
      }

      if (!emailResult || !emailResult.email) return;

      let codeResult = await showCodeStep(emailResult.email);

      while (codeResult && codeResult.back) {
        emailResult = await showEmailStep();
        if (!emailResult || !emailResult.email) return;
        codeResult = await showCodeStep(emailResult.email);
      }

      if (!codeResult || !codeResult.email) return;

      const pwResult = await showPasswordStep(codeResult.email);

      if (pwResult && pwResult.success) {
        const box = document.getElementById("loginError");
        if (box) {
          box.className = "login-success";
          box.textContent =
            "Password updated. You can now sign in with your new password.";
          box.hidden = false;
          setTimeout(() => {
            box.hidden = true;
            box.className = "login-error";
          }, 5000);
        }
        const emailInput = document.getElementById("email");
        if (emailInput) emailInput.value = codeResult.email;
        const passInput = document.getElementById("password");
        if (passInput) passInput.focus();
      }
    } finally {
      _flowRunning = false;
    }
  }

  window.ewStartForgotPasswordFlow = startForgotPasswordFlow;

  document.addEventListener("DOMContentLoaded", function () {
    document
      .querySelectorAll('[data-action="forgot-password"]')
      .forEach((el) => {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          startForgotPasswordFlow();
        });
      });
  });
})();
