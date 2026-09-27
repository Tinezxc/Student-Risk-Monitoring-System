/* ============================================================
   EarlyWatch — Verify page logic (animated OTP boxes)
   Reads pending signup from sessionStorage (set by register.js),
   checks the code, marks the user verified, redirects to login.
   Depends on: js/db.js, js/auth.js
   ============================================================ */
(function () {
  "use strict";

  const VERIFICATION_CODE = "12345";
  const PENDING_KEY = "earlywatch.pendingVerify";

  const form       = document.getElementById("verifyForm");
  const row        = document.getElementById("otpRow");
  const boxes      = row ? Array.from(row.querySelectorAll(".otp-box")) : [];
  const errorBox   = document.getElementById("verifyError");
  const successBox = document.getElementById("verifySuccess");
  const verifyBtn  = document.getElementById("verifyBtn");
  const subtitle   = document.getElementById("verifySubtitle");
  const resendLink = document.getElementById("resendLink");

  if (!form || !row || boxes.length === 0) {
    console.warn("[verify] Missing required elements");
    return;
  }

  /* ---------- Read pending signup ---------- */
  let pending = null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    pending = raw ? JSON.parse(raw) : null;
  } catch (err) { pending = null; }

  if (!pending || !pending.email) {
    window.location.replace("register.html");
    return;
  }

  subtitle.textContent = "Enter the 5-digit code sent to " + pending.email;

  /* ---------- UI helpers ---------- */
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

  function setErrorState(on) {
    row.classList.toggle("error", !!on);
  }
  function clearErrorState() {
    row.classList.remove("error");
  }
  function shake() {
    row.classList.remove("shake");
    void row.offsetWidth; // force reflow so animation restarts
    row.classList.add("shake");
    setTimeout(function () { row.classList.remove("shake"); }, 450);
  }
  function successPulse() {
    row.classList.add("success");
  }
  function popBox(box) {
    box.classList.remove("pop");
    void box.offsetWidth;
    box.classList.add("pop");
  }

  function getCode() {
    return boxes.map(function (b) { return b.value; }).join("");
  }
  function setBoxesDisabled(disabled) {
    boxes.forEach(function (b) { b.disabled = !!disabled; });
  }

  /* ---------- Wire each digit box ---------- */
  boxes.forEach(function (box, i) {
    // On input
    box.addEventListener("input", function (e) {
      const val = e.target.value.replace(/\D/g, "");
      box.value = val.slice(-1);

      box.classList.toggle("filled", box.value !== "");
      clearErrorState();

      if (box.value) {
        popBox(box);
        if (i < boxes.length - 1) boxes[i + 1].focus();
      }
    });

    // On keydown
    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace") {
        if (box.value === "" && i > 0) {
          boxes[i - 1].focus();
          boxes[i - 1].value = "";
          boxes[i - 1].classList.remove("filled");
          e.preventDefault();
        } else {
          setTimeout(function () {
            box.classList.toggle("filled", box.value !== "");
            clearErrorState();
          }, 0);
        }
      }
      if (e.key === "ArrowLeft"  && i > 0)                { boxes[i - 1].focus(); e.preventDefault(); }
      if (e.key === "ArrowRight" && i < boxes.length - 1) { boxes[i + 1].focus(); e.preventDefault(); }
    });

    box.addEventListener("focus", function () { box.select(); });

    // Paste distributes digits
    box.addEventListener("paste", function (e) {
      const text = (e.clipboardData || window.clipboardData).getData("text") || "";
      const digits = text.replace(/\D/g, "");
      if (!digits) return;
      e.preventDefault();
      clearErrorState();
      const start = i;
      for (let k = 0; k < digits.length && start + k < boxes.length; k++) {
        const b = boxes[start + k];
        b.value = digits[k];
        b.classList.add("filled");
        popBox(b);
      }
      const lastFilled = Math.min(start + digits.length, boxes.length) - 1;
      boxes[lastFilled].focus();
    });
  });

  setTimeout(function () { boxes[0].focus(); }, 80);

  /* ---------- Verify ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearMessages();
    clearErrorState();

    const code = getCode();

    if (code.length !== boxes.length) {
      showError("Please enter the full " + boxes.length + "-digit code.");
      setErrorState(true);
      shake();
      const firstEmpty = boxes.findIndex(function (b) { return !b.value; });
      if (firstEmpty !== -1) boxes[firstEmpty].focus();
      return;
    }

    if (code !== VERIFICATION_CODE) {
      showError("Incorrect code. Please try again.");
      setErrorState(true);
      shake();
      setTimeout(function () {
        boxes.forEach(function (b) {
          b.value = "";
          b.classList.remove("filled");
        });
        clearErrorState();
        boxes[0].focus();
      }, 420);
      return;
    }

    // Mark the user as verified
    const mark = EW_DB.users.markVerified(pending.email);
    if (!mark.ok) {
      showError("Could not verify this account. Please try registering again.");
      shake();
      return;
    }

    sessionStorage.removeItem(PENDING_KEY);

    setBoxesDisabled(true);
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verified ✓";
    successPulse();
    showSuccess("Account verified! Redirecting to sign-in…");

    setTimeout(function () {
      window.location.href = "index.html";
    }, 1100);
  });

  /* ---------- Resend ---------- */
  resendLink.addEventListener("click", function (e) {
    e.preventDefault();
    clearMessages();
    clearErrorState();
    boxes.forEach(function (b) {
      b.value = "";
      b.classList.remove("filled");
      b.disabled = false;
    });
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify";
    boxes[0].focus();
    resendLink.textContent = "Sent ✓";
    setTimeout(function () { resendLink.textContent = "Resend"; }, 1500);
  });
})();

slot.animate(
  {
    transform: `translate(${dx[i]}px) rotate(${ANG[i]}deg)`
  },
  {
    duration: 500,
    delay: i * 45
  }
);