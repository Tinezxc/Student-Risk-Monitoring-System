/* ============================================================
   EarlyWatch — Password show/hide toggle
   Automatically wires any input[type="password"] that is
   wrapped in a <div class="password-wrapper">.
   ============================================================ */
(function () {
  "use strict";

  function wireToggle(wrapper) {
    const input = wrapper.querySelector('input[type="password"]');
    if (!input) return;
    if (wrapper.dataset.toggleWired === "1") return;
    wrapper.dataset.toggleWired = "1";

    // Build the toggle button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "password-toggle";
    btn.setAttribute("aria-label", "Show password");
    btn.tabIndex = -1;
    btn.innerHTML = `
      <svg class="eye-open" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <svg class="eye-closed" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"
           style="display:none;">
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`;
    wrapper.appendChild(btn);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      btn.querySelector(".eye-open").style.display   = isHidden ? "none" : "";
      btn.querySelector(".eye-closed").style.display = isHidden ? ""     : "none";
      input.focus();
    });
  }

  function wireAll() {
    document.querySelectorAll(".password-wrapper").forEach(wireToggle);
  }

  document.addEventListener("DOMContentLoaded", wireAll);

  // Expose for pages that render inputs dynamically
  window.ewWirePasswordToggles = wireAll;
})();