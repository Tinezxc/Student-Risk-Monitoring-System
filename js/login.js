/* ============================================================
   EarlyWatch — Login page logic
   Depends on: js/db.js, js/auth.js
   ============================================================ */
(function () {
  "use strict";

  const form       = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passInput  = document.getElementById("password");
  const errorBox   = document.getElementById("loginError");
  const submitBtn  = document.getElementById("submitBtn");

  if (!form) return; // not on this page

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  /* Demo account chips — click to auto-fill */
  document.querySelectorAll(".demo-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      emailInput.value = chip.dataset.email;
      passInput.value  = chip.dataset.password;
      emailInput.focus();
    });
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      showError("Please enter both your email and password.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    const account = await ewLogin(email, password);

    if (account) {
      window.location.href = account.redirect;
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
      showError("Invalid email or password. Please try again.");
      passInput.value = "";
      passInput.focus();
    }
  });
})();