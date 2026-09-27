/* ============================================================
   EarlyWatch — Auth layer (frontend only)
   Credentials checked against EW_DB.users.
   Session kept in sessionStorage.
   ============================================================ */

const EW_SESSION_KEY = "earlywatch.session";

const EW_ROLE_REDIRECT = {
  admin:      "admin-dashboard.html",
  instructor: "instructor-dashboard.html",
  student:    "student-dashboard.html"
};

/* ------------------------------------------------------------
   Login
   ------------------------------------------------------------ */
async function ewLogin(email, password) {
  const user = EW_DB.users.find(email);
  if (!user || user.password !== password) return null;

  // Block unverified accounts
  if (user.role === "student" && user.verified === false) {
    sessionStorage.setItem("earlywatch.pendingVerify", JSON.stringify({ email: user.email }));
    window.location.href = "verify.html";
    return null;
  }

  sessionStorage.setItem(EW_SESSION_KEY, JSON.stringify({
    role:      user.role,
    title:     user.title,
    name:      user.name,
    initials:  user.initials,
    email:     user.email,
    studentId: user.studentId
  }));

  return {
    role:      user.role,
    title:     user.title,
    name:      user.name,
    initials:  user.initials,
    email:     user.email,
    studentId: user.studentId,
    redirect:  EW_ROLE_REDIRECT[user.role] || "index.html"
  };
}

/* ------------------------------------------------------------
   Register (student-only from the UI)
   Creates BOTH a user account and a matching student record.
   ------------------------------------------------------------ */
async function ewRegister(data) {
  const errors = [];

  const firstName = (data.firstName || "").trim();
  const lastName  = (data.lastName  || "").trim();
  const fullName  = (data.name || [firstName, lastName].filter(Boolean).join(" ")).trim();

  if (!firstName) errors.push("First name is required.");
  if (!lastName)  errors.push("Last name is required.");
  if (!data.gender) errors.push("Gender / Sex is required.");
  if (!data.address || !data.address.trim()) errors.push("Address is required.");
  if (!data.email || !data.email.trim()) errors.push("Email address is required.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Please enter a valid email address.");

  if (typeof ewValidateSchoolId === "function") {
    const sidCheck = ewValidateSchoolId(data.studentId);
    if (!sidCheck.ok) errors.push(...sidCheck.errors);
  } else if (!data.studentId || !data.studentId.trim()) {
    errors.push("School ID is required.");
  }

  if (!data.password) errors.push("Password is required.");
  else if (typeof ewValidatePassword === "function") {
    const pwCheck = ewValidatePassword(data.password);
    if (!pwCheck.ok) errors.push(...pwCheck.errors);
  }

  if (errors.length) return { ok: false, errors };

  /* ----- 1) Create the user account ----- */
  const initials = (function () {
    let out = "";
    if (firstName) out += firstName[0].toUpperCase();
    if (lastName)  out += lastName[0].toUpperCase();
    return out || "??";
  })();

  const userResult = EW_DB.users.add({
    role:      "student",
    title:     "Student",
    name:      fullName,
    firstName: firstName,
    lastName:  lastName,
    initials:  initials,
    gender:    data.gender,
    address:   data.address.trim(),
    email:     data.email.trim().toLowerCase(),
    password:  data.password,
    studentId: data.studentId.trim()
  });

  if (!userResult.ok) return userResult;

  /* ----- 2) Create the matching student record ----- */
  const sidParts = String(data.studentId).split("-");
  const deptCode = (sidParts[1] || "").toUpperCase();

  const deptToCourse = {
    COLL: "BS Information Technology",
    CCS:  "BS Computer Science",
    IS:   "BS Information Systems",
    IT:   "BS Information Technology",
    CS:   "BS Computer Science",
    BSIT: "BS Information Technology",
    BSCS: "BS Computer Science",
    BSIS: "BS Information Systems"
  };
  const course = deptToCourse[deptCode] || "BS Information Technology";
  const sectionYear = sidParts[2] ? String(parseInt(sidParts[2], 10) % 100) : "24";
  const section = `${deptCode || "COLL"} ${sectionYear}-A`;

  const studentResult = await EW_DB.addStudent({
    id:             data.studentId.trim(),
    name:           fullName,
    course:         course,
    section:        section,
    adviser:        "",
    caseStatus:     "Monitoring",
    gpa:            null,
    attendance:     null,
    missed:         0,
    failedSubjects: 0,
    subjects:       [],
    history:        [],
    notes:          []
  });

  if (!studentResult.ok) {
    try {
      const store = JSON.parse(localStorage.getItem("earlywatch.db.v1") || "{}");
      if (Array.isArray(store.users)) {
        store.users = store.users.filter(u =>
          String(u.email || "").toLowerCase() !== data.email.trim().toLowerCase()
        );
        localStorage.setItem("earlywatch.db.v1", JSON.stringify(store));
      }
    } catch (_) {}
    return { ok: false, errors: studentResult.errors || ["Could not create student record."] };
  }

  return { ok: true };
}

/* ------------------------------------------------------------
   Session helpers
   ------------------------------------------------------------ */
function ewCurrentUser() {
  try {
    const raw = sessionStorage.getItem(EW_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

/* ------------------------------------------------------------
   Logout — clears session + hard-blocks bfcache restore
   ------------------------------------------------------------ */
function ewLogout() {
  /* 1) Set a "logging out" flag so any page that tries to
        restore from bfcache can detect it instantly. */
  try {
    sessionStorage.setItem("earlywatch.loggedOutAt", String(Date.now()));
  } catch (_) {}

  /* 2) Clear the session */
  try {
    sessionStorage.removeItem(EW_SESSION_KEY);
    sessionStorage.removeItem("earlywatch.pendingVerify");
    sessionStorage.removeItem("earlywatch.resetSession");
  } catch (_) {}

  /* 3) Mark the current page as NOT cacheable.
        This must run BEFORE navigation. Modern browsers
        will drop the page from bfcache when pagehide fires
        with this flag set. */
  try {
    window.__ewLoggingOut = true;
    window.addEventListener("pagehide", function (e) {
      try { e.preventDefault && e.preventDefault(); } catch (_) {}
    });
  } catch (_) {}

  /* 4) Blank the DOM immediately — even if bfcache keeps the page,
        the visual snapshot will be empty. */
  try {
    document.documentElement.innerHTML = "";
    document.body && (document.body.innerHTML = "");
  } catch (_) {}

  /* 5) Replace the current history entry so Back can't return here */
  window.location.replace("index.html");
}

function ewRedirectFor(role) {
  return EW_ROLE_REDIRECT[role] || "index.html";
}

/* ------------------------------------------------------------
   Guard state — module-level, reset on every fresh navigation
   ------------------------------------------------------------ */
let _ewGuardHandled = false;

/* ------------------------------------------------------------
   Page guard — accepts a single role OR an array of roles.
   Runs the check on: load, pageshow (bfcache), visibilitychange,
   popstate (Back button), and hashchange — plus a short
   high-frequency poll for the first few seconds to catch
   rapid Back-button spam.
   ------------------------------------------------------------ */
function ewGuard(requiredRole) {
  const allowed = Array.isArray(requiredRole)
    ? requiredRole
    : (requiredRole ? [requiredRole] : null);

  function enforce() {
    if (_ewGuardHandled) return null;

    // Detect "just logged out" from any tab
    try {
      const logoutAt = Number(sessionStorage.getItem("earlywatch.loggedOutAt") || 0);
      if (logoutAt && Date.now() - logoutAt < 5 * 60 * 1000) {
        // A logout happened within the last 5 minutes and there's
        // no session — treat as still logged out.
        if (!ewCurrentUser()) {
          _ewGuardHandled = true;
          window.location.replace("index.html");
          return null;
        }
      }
    } catch (_) {}

    const current = ewCurrentUser();

    if (!current) {
      _ewGuardHandled = true;
      window.location.replace("index.html");
      return null;
    }

    if (allowed && !allowed.includes(current.role)) {
      _ewGuardHandled = true;
      window.location.replace(ewRedirectFor(current.role));
      return null;
    }

    return current;
  }

  /* 1) Enforce immediately on script load */
  const initial = enforce();
  if (!initial) return null;

  /* 2) pageshow — covers bfcache restore (Back/Forward) */
  window.addEventListener("pageshow", function () {
    _ewGuardHandled = false;   // reset so we can act on the restore
    enforce();
  });

  /* 3) popstate — fires on Back/Forward for history navigations */
  window.addEventListener("popstate", function () {
    _ewGuardHandled = false;
    enforce();
  });

  /* 4) hashchange — catches some Back-button edge cases */
  window.addEventListener("hashchange", function () {
    _ewGuardHandled = false;
    enforce();
  });

  /* 5) visibilitychange — catches tab-switch / focus returns */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      _ewGuardHandled = false;
      enforce();
    }
  });

  /* 6) Focus — extra safety for mobile Safari */
  window.addEventListener("focus", function () {
    _ewGuardHandled = false;
    enforce();
  });

  /* 7) Rapid poll for the first few seconds.
        This is the ONLY reliable way to catch Back-button spam
        that happens faster than any browser event can fire. */
  let ticks = 0;
  const fast = setInterval(function () {
    ticks++;
    if (!ewCurrentUser()) {
      _ewGuardHandled = true;
      clearInterval(fast);
      window.location.replace("index.html");
      return;
    }
    if (ticks >= 40) {   // ~4 seconds at 100ms
      clearInterval(fast);
    }
  }, 100);

  /* 8) Slow heartbeat forever — belt and braces */
  setInterval(function () {
    if (!ewCurrentUser()) {
      _ewGuardHandled = true;
      window.location.replace("index.html");
    }
  }, 1500);

  return initial;
}

/* ------------------------------------------------------------
   Resolve current avatar image (returns data URL or null)
   ------------------------------------------------------------ */
function ewResolveAvatarImage(user) {
  if (!user) return null;
  try {
    if (typeof EW_DB === "undefined" || !EW_DB.adviserProfile) return null;
    if (user.role !== "adviser") return null;
    const profile = EW_DB.adviserProfile.get(user);
    return profile && profile.avatarImage ? profile.avatarImage : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------
   Apply avatar image to every [data-user-initials] element
   ------------------------------------------------------------ */
function ewApplyAvatar() {
  const user = ewCurrentUser();
  if (!user) return;

  const avatarImage = ewResolveAvatarImage(user);

  document.querySelectorAll("[data-user-initials]").forEach(function (el) {
    if (avatarImage) {
      el.classList.add("avatar-with-image");
      el.style.backgroundImage = `url("${avatarImage}")`;
      el.textContent = "";
    } else {
      el.classList.remove("avatar-with-image");
      el.style.backgroundImage = "";
      el.textContent = user.initials;
    }
  });
}

/* ------------------------------------------------------------
   Paint sidebar user block
   ------------------------------------------------------------ */
function ewPaintUser() {
  const user = ewCurrentUser();
  if (!user) return;

  document.querySelectorAll("[data-user-name]").forEach(function (el) {
    el.textContent = user.name;
  });
  document.querySelectorAll("[data-user-role]").forEach(function (el) {
    el.textContent = user.title;
  });

  ewApplyAvatar();
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  ewPaintUser();
  if (window.lucide) lucide.createIcons();

  /* Sync sidebar alert badges */
  try {
    if (typeof EW_DB !== "undefined" && EW_DB.alerts) {
      const n = EW_DB.alerts.unread().length;
      document.querySelectorAll("#navAlertCount").forEach(function (el) {
        el.textContent = n;
        el.setAttribute("data-zero", n === 0 ? "true" : "false");
      });
    }
  } catch (_) {}

  if (typeof EW_DB !== "undefined" && EW_DB.subscribe) {
    EW_DB.subscribe(function () {
      ewApplyAvatar();
      try {
        const n = EW_DB.alerts.unread().length;
        document.querySelectorAll("#navAlertCount").forEach(function (el) {
          el.textContent = n;
          el.setAttribute("data-zero", n === 0 ? "true" : "false");
        });
      } catch (_) {}
    });
  }
});

/* ------------------------------------------------------------
   Cross-tab sync — if another tab logs out, mirror it here
   ------------------------------------------------------------ */
window.addEventListener("storage", function (e) {
  if (e.key === "earlywatch.adviserProfile") {
    ewApplyAvatar();
  }
  if (e.key === EW_SESSION_KEY && !e.newValue) {
    // Another tab logged out — kick this one too
    try { sessionStorage.removeItem(EW_SESSION_KEY); } catch (_) {}
    window.location.replace("index.html");
  }
});

/* ------------------------------------------------------------
   Password policy
   ------------------------------------------------------------ */
const EW_PASSWORD_SYMBOL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

function ewValidatePassword(password) {
  const errors = [];
  if (!password) { errors.push("Password is required."); return { ok: false, errors }; }
  if (password.length > 128) errors.push("Password must be 128 characters or fewer.");
  if (!EW_PASSWORD_SYMBOL_RE.test(password)) {
    errors.push("Password must include at least one symbol (e.g. ! @ # $ % ^ & *).");
  }
  return { ok: errors.length === 0, errors };
}
window.ewValidatePassword = ewValidatePassword;

/* ------------------------------------------------------------
   School ID helpers
   ------------------------------------------------------------ */
const EW_SCHOOL_ID_RE = /^[0-9]{2}-[A-Z]{3,5}-[0-9]{2}-[0-9]{4}$/;

function ewValidateSchoolId(id) {
  const errors = [];
  const value = String(id || "").trim();
  if (!value) { errors.push("School ID is required."); return { ok: false, errors }; }
  if (!EW_SCHOOL_ID_RE.test(value)) {
    errors.push("School ID must follow the format 01-COLL-24-2742.");
  }
  return { ok: errors.length === 0, errors };
}

function ewSuggestSchoolId(prefix) {
  const year2 = String(new Date().getFullYear()).slice(-2);
  const base = prefix || `01-COLL-${year2}`;
  let maxSuffix = 1000;
  try {
    if (typeof EW_DB !== "undefined" && EW_DB.users && EW_DB.users.all) {
      EW_DB.users.all().forEach(u => {
        const sid = String(u.studentId || "");
        if (sid.startsWith(base + "-")) {
          const tail = parseInt(sid.split("-").pop(), 10);
          if (!isNaN(tail) && tail > maxSuffix) maxSuffix = tail;
        }
      });
    }
  } catch (_) {}
  const next = String(maxSuffix + 1).padStart(4, "0");
  return `${base}-${next}`;
}

function ewFormatSchoolIdInput(raw) {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parts = [];
  let rest = clean;

  let m = rest.match(/^(\d{2})/);
  if (m) { parts.push(m[1]); rest = rest.slice(2); }

  m = rest.match(/^([A-Z]{1,5})/);
  if (m) { parts.push(m[1]); rest = rest.slice(m[1].length); }

  m = rest.match(/^(\d{2})/);
  if (m) { parts.push(m[1]); rest = rest.slice(2); }

  m = rest.match(/^(\d{1,4})/);
  if (m) { parts.push(m[1]); }

  return parts.join("-");
}

window.ewValidateSchoolId = ewValidateSchoolId;
window.ewSuggestSchoolId  = ewSuggestSchoolId;
window.ewFormatSchoolIdInput = ewFormatSchoolIdInput;