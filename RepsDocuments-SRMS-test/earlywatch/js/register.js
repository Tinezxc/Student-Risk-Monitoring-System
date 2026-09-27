/* ============================================================
   EarlyWatch — Register page logic
   Depends on: js/db.js, js/auth.js
   ============================================================ */
(function () {
  "use strict";

  const PENDING_KEY = "earlywatch.pendingVerify";

  const form         = document.getElementById("registerForm");
  const firstNameEl  = document.getElementById("firstName");
  const lastNameEl   = document.getElementById("lastName");
  const genderEl     = document.getElementById("gender");
  const addressEl    = document.getElementById("address");
  const emailInput   = document.getElementById("email");
  const studentIdEl  = document.getElementById("studentId");
  const passInput    = document.getElementById("password");
  const confirmInput = document.getElementById("confirm");
  const nameHidden   = document.getElementById("name");
  const errorBox     = document.getElementById("registerError");
  const successBox   = document.getElementById("registerSuccess");
  const submitBtn    = document.getElementById("registerBtn");

  if (!form) return;

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    successBox.hidden = true;
  }
  function showSuccess(msg) {
    successBox.textContent = msg;
    successBox.hidden = false;
    errorBox.hidden = true;
  }
  function clearMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
    errorBox.textContent = "";
    successBox.textContent = "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMessages();

    const firstName = firstNameEl.value.trim();
    const lastName  = lastNameEl.value.trim();
    const fullName  = [firstName, lastName].filter(Boolean).join(" ");
    nameHidden.value = fullName;

    const data = {
      role:      "student",
      firstName: firstName,
      lastName:  lastName,
      name:      fullName,
      gender:    genderEl.value,
      address:   addressEl.value.trim(),
      email:     emailInput.value.trim(),
      studentId: studentIdEl.value.trim(),
      password:  passInput.value,
      confirm:   confirmInput.value
    };

    /* ---------- Client-side validation (mirrors ewRegister) ---------- */
    if (!data.firstName || !data.lastName) { showError("Please enter your first and last name."); return; }
    if (!data.gender)                       { showError("Please select your gender / sex."); return; }
    if (!data.address)                      { showError("Please enter your address."); return; }
    if (!data.email)                        { showError("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showError("Please enter a valid email address."); return; }

    if (typeof ewValidateSchoolId === "function") {
      const sidCheck = ewValidateSchoolId(data.studentId);
      if (!sidCheck.ok) { showError(sidCheck.errors.join(" ")); return; }
    } else if (!data.studentId) {
      showError("Please enter your school ID.");
      return;
    }

    if (!data.password)                 { showError("Please enter a password."); return; }
    if (data.password !== data.confirm) { showError("Passwords do not match."); return; }

    if (typeof ewValidatePassword === "function") {
      const pwCheck = ewValidatePassword(data.password);
      if (!pwCheck.ok) { showError(pwCheck.errors.join(" ")); return; }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";

    const result = await ewRegister(data);

    if (!result.ok) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
      showError(result.errors.join(" "));
      return;
    }

    /* ---------- Stash pending signup, redirect to verify page ---------- */
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      email: data.email.trim().toLowerCase()
    }));

    showSuccess("Account created! Redirecting to verification…");
    submitBtn.textContent = "Redirecting…";

    setTimeout(function () {
      window.location.href = "verify.html";
    }, 700);
  });
})();