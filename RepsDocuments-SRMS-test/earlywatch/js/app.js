/* ============================================================
   EarlyWatch — Shared UI Behaviours (frontend-only)
   Depends on: db.js, risk.js, auth.js
   ============================================================ */

/* ---------- Helpers ---------- */
function ewEsc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
  );
}

function ewRiskColorClass(level) {
  return { critical:"text-danger", high:"text-warning", medium:"text-info", low:"text-success" }[level];
}

function ewAttendanceBar(pct) {
  const level = pct < 60 ? "critical" : pct < 75 ? "high" : "low";
  return `
    <div class="attendance-cell">
      <div class="bar-container"><div class="bar-fill ${level}" style="width:${pct}%"></div></div>
      <span class="attendance-val">${pct}%</span>
    </div>`;
}

/* ============================================================
   MODAL SYSTEM
   ============================================================ */
function ewShowModal({ title, bodyHTML, footerHTML, width = 520 }) {
  const overlay = document.createElement("div");
  overlay.className = "ew-modal-overlay";
  overlay.innerHTML = `
    <div class="ew-modal" style="max-width:${width}px" role="dialog" aria-modal="true">
      <div class="ew-modal-header">
        <h2>${ewEsc(title)}</h2>
        <button type="button" class="ew-modal-close" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="ew-modal-body">${bodyHTML}</div>
      <div class="ew-modal-footer">${footerHTML || ""}</div>
    </div>`;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });

  let isClosed = false;
  function close(value) {
    if (isClosed) return;
    isClosed = true;
    overlay.classList.add("closing");
    setTimeout(() => overlay.remove(), 140);
    resolveClosed(value);
  }

  overlay.addEventListener("click", e => { if (e.target === overlay) close(null); });
  overlay.querySelector(".ew-modal-close").addEventListener("click", () => close(null));

  function onKey(e) {
    if (e.key === "Escape") { document.removeEventListener("keydown", onKey); close(null); }
  }
  document.addEventListener("keydown", onKey);

  return { overlay, close, closed };
}

function ewConfirm({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
  const { overlay, close, closed } = ewShowModal({
    title,
    bodyHTML: `<p class="ew-modal-text">${body}</p>`,
    footerHTML: `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">${ewEsc(cancelLabel)}</button>
      <button type="button" class="ew-btn ${danger ? "ew-btn-danger" : "ew-btn-primary"}"
              data-role="confirm">${ewEsc(confirmLabel)}</button>`,
    width: 440
  });

  overlay.querySelector('[data-role="cancel"]').onclick  = () => close(false);
  overlay.querySelector('[data-role="confirm"]').onclick = () => close(true);

  return closed;
}

/* ============================================================
   ADD STUDENT — public entry point
   ============================================================ */
async function ewOpenAddStudent(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (typeof ewStudentFormModal !== "function") {
    console.error("[EarlyWatch] ewStudentFormModal is not defined.");
    alert("Could not open the form — the application scripts are missing.");
    return;
  }

  try {
    const created = await ewStudentFormModal(null);
    if (created) console.log("[EarlyWatch] Student added:", created);
  } catch (err) {
    console.error("[EarlyWatch] Add Student modal threw:", err);
    alert("Something went wrong opening the form.\n" +
          (err && err.message ? err.message + "\n" : "") +
          "See the browser console for details.");
  }
}
window.ewOpenAddStudent = ewOpenAddStudent;

/* ============================================================
   DEFAULTS
   ============================================================ */
const EW_NEW_STUDENT_DEFAULTS = {
  gpa:            2.00,
  attendance:     100,
  missed:         0,
  failedSubjects: 0,
  caseStatus:     "Monitoring"
};

function ewNextStudentId() {
  const year = new Date().getFullYear();
  let used = new Set();
  try {
    if (typeof EW_DB !== "undefined" && EW_DB.students && typeof EW_DB.students.all === "function") {
      used = new Set(EW_DB.students.all().map(s => s.id));
    }
  } catch (e) {
    console.warn("[EarlyWatch] Could not read existing student IDs:", e);
  }
  let candidate;
  do {
    candidate = `${year}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  } while (used.has(candidate));
  return candidate;
}

/* ============================================================
   FORM BUILDER HELPERS
   ============================================================ */
function ewField(name, label, type = "text", value = "", extra = "") {
  return `
    <label class="ew-field">
      <span>${ewEsc(label)}</span>
      <input type="${type}" name="${name}"
             value="${value != null ? ewEsc(value) : ""}" ${extra}>
    </label>`;
}

function ewSelectField(name, label, options, selected) {
  const opts = options.map(o =>
    `<option value="${ewEsc(o)}" ${selected === o ? "selected" : ""}>${ewEsc(o)}</option>`
  ).join("");
  return `
    <label class="ew-field">
      <span>${ewEsc(label)}</span>
      <select name="${name}">${opts}</select>
    </label>`;
}

/* ============================================================
   STUDENT FORM MODAL — dispatches to Add or Edit
   ============================================================ */
function ewStudentFormModal(existing) {
  return existing ? ewEditStudentModal(existing) : ewAddStudentModal();
}
window.ewStudentFormModal = ewStudentFormModal;

/* ------------------------------------------------------------
   ADD STUDENT
   ------------------------------------------------------------ */
function ewAddStudentModal() {
  const suggestedId = ewNextStudentId();
  const d = EW_NEW_STUDENT_DEFAULTS;

  const bodyHTML = `
    <form id="ewStudentForm" novalidate>
      <div class="ew-form-error" hidden></div>
      <div class="ew-form-grid">
        ${ewField("name",    "Full name",    "text", "", "required")}
        ${ewField("id",      "Student ID",   "text", suggestedId, "required readonly")}
        ${ewField("course",  "Course",       "text")}
        ${ewField("section", "Section",      "text")}
        ${ewField("adviser", "Adviser",      "text")}
        ${ewSelectField("caseStatus", "Case Status",
              ["Open", "In-Progress", "Monitoring", "Resolved"], d.caseStatus)}
      </div>
    </form>`;

  const footerHTML = `
    <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
    <button type="button" class="ew-btn ew-btn-primary" data-role="save">Add student</button>`;

  const { overlay, close, closed } = ewShowModal({
    title: "Add Student",
    bodyHTML, footerHTML, width: 560
  });

  const form    = overlay.querySelector("#ewStudentForm");
  const errBox  = overlay.querySelector(".ew-form-error");
  const saveBtn = overlay.querySelector('[data-role="save"]');

  overlay.querySelector('[data-role="cancel"]').onclick = () => close(null);

  const showError = msg => { errBox.textContent = msg; errBox.hidden = false; };

  async function save() {
    const data = Object.fromEntries(new FormData(form).entries());

    const errs = [];
    if (!data.name || !data.name.trim()) errs.push("Name is required.");
    if (!data.id   || !data.id.trim())   errs.push("Student ID is required.");
    if (errs.length) { showError(errs.join(" ")); return; }

    errBox.hidden = true;
    saveBtn.disabled = true;
    const original = saveBtn.textContent;
    saveBtn.textContent = "Adding…";

    const payload = {
      name:           data.name.trim(),
      id:             data.id.trim(),
      course:         data.course  || "",
      section:        data.section || "",
      adviser:        data.adviser || "",
      caseStatus:     data.caseStatus || d.caseStatus,
      gpa:            d.gpa,
      attendance:     d.attendance,
      missed:         d.missed,
      failedSubjects: d.failedSubjects
    };

    let result;
    try {
      result = await EW_DB.addStudent(payload);
    } catch (err) {
      console.error("[EarlyWatch] Add failed:", err);
      result = { ok: false, errors: ["Could not save student locally."] };
    }

    if (!result || !result.ok) {
      const list = (result && result.errors) ? result.errors : ["Save failed."];
      showError(list.join(" "));
      saveBtn.disabled = false;
      saveBtn.textContent = original;
      return;
    }

    close(result.student || null);
  }

  saveBtn.onclick = save;
  form.addEventListener("submit", e => { e.preventDefault(); save(); });

  const firstInput = overlay.querySelector('input[name="name"]');
  if (firstInput) setTimeout(() => firstInput.focus(), 30);

  return closed;
}

/* ------------------------------------------------------------
   EDIT STUDENT
   ------------------------------------------------------------ */
function ewEditStudentModal(existing) {
  const v = existing;

  const currentRiskLevel = (typeof EW_RISK !== "undefined")
    ? EW_RISK.compute(v).level
    : "low";

  const riskLevels = ["critical", "high", "medium", "low"];
  const riskLabels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

  const bodyHTML = `
    <form id="ewStudentForm" novalidate>
      <div class="ew-form-error" hidden></div>
      <div class="ew-form-grid">
        ${ewSelectField(
            "riskLevel",
            "Risk Level",
            riskLevels.map(l => riskLabels[l]),
            riskLabels[currentRiskLevel]
        )}
        ${ewField("gpa",        "GPA",              "number", v.gpa,        'step="0.01" min="0" max="4"')}
        ${ewField("attendance", "Attendance (%)",   "number", v.attendance, 'min="0" max="100"')}
        ${ewField("missed",     "Missed Activities","number", v.missed,     'min="0"')}
        ${ewSelectField("caseStatus", "Case Status",
              ["Open", "In-Progress", "Monitoring", "Resolved"], v.caseStatus)}
      </div>
    </form>`;

  const footerHTML = `
    <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
    <button type="button" class="ew-btn ew-btn-primary" data-role="save">Save changes</button>`;

  const { overlay, close, closed } = ewShowModal({
    title: `Edit ${v.name}`,
    bodyHTML, footerHTML, width: 520
  });

  const form    = overlay.querySelector("#ewStudentForm");
  const errBox  = overlay.querySelector(".ew-form-error");
  const saveBtn = overlay.querySelector('[data-role="save"]');

  const gpaInput   = form.elements["gpa"];
  const attInput   = form.elements["attendance"];
  const missInput  = form.elements["missed"];
  const riskSelect = form.elements["riskLevel"];

  const RISK_PRESETS = {
    critical: { gpa: 1.60, attendance: 55, missed: 10 },
    high:     { gpa: 2.00, attendance: 68, missed: 6  },
    medium:   { gpa: 2.40, attendance: 80, missed: 3  },
    low:      { gpa: 3.00, attendance: 95, missed: 0  }
  };

  riskSelect.addEventListener("change", () => {
    const key = riskSelect.value.toLowerCase();
    const preset = RISK_PRESETS[key];
    if (!preset) return;
    gpaInput.value  = preset.gpa.toFixed(2);
    attInput.value  = preset.attendance;
    missInput.value = preset.missed;
  });

  overlay.querySelector('[data-role="cancel"]').onclick = () => close(null);

  const showError = msg => { errBox.textContent = msg; errBox.hidden = false; };

  async function save() {
    const gpa        = parseFloat(gpaInput.value);
    const attendance = parseInt(attInput.value, 10);
    const missed     = parseInt(missInput.value, 10);
    const riskLevel  = riskSelect.value.toLowerCase();
    const caseStatus = form.elements["caseStatus"].value;

    const errs = [];
    if (isNaN(gpa) || gpa < 0 || gpa > 4)
      errs.push("GPA must be between 0 and 4.");
    if (isNaN(attendance) || attendance < 0 || attendance > 100)
      errs.push("Attendance must be between 0 and 100.");
    if (isNaN(missed) || missed < 0)
      errs.push("Missed activities must be a non-negative number.");
    if (errs.length) { showError(errs.join(" ")); return; }

    errBox.hidden = true;
    saveBtn.disabled = true;
    const original = saveBtn.textContent;
    saveBtn.textContent = "Saving…";

    const payload = {
      gpa:        gpa,
      attendance: attendance,
      missed:     missed,
      caseStatus: caseStatus,
      riskLevel:  riskLevel
    };

    let result;
    try {
      result = await EW_DB.updateStudent(v.id, payload);
    } catch (err) {
      console.error("[EarlyWatch] Edit failed:", err);
      result = { ok: false, errors: ["Could not save changes locally."] };
    }

    if (!result || !result.ok) {
      const list = (result && result.errors) ? result.errors : ["Save failed."];
      showError(list.join(" "));
      saveBtn.disabled = false;
      saveBtn.textContent = original;
      return;
    }

    close(result.student || null);
  }

  saveBtn.onclick = save;
  form.addEventListener("submit", e => { e.preventDefault(); save(); });

  setTimeout(() => { gpaInput.focus(); gpaInput.select(); }, 30);

  return closed;
}

/* ============================================================
   RECORDS TABLE RENDERER
   ============================================================ */
function ewRenderRecordsTable(tbody, students) {
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-muted" style="text-align:center;padding:2rem;">
      No students match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const r = EW_RISK.compute(s);
    const cls = ewRiskColorClass(r.level);
    const caseClass = s.caseStatus === "Open"       ? "text-danger"
                    : s.caseStatus === "Resolved"   ? "text-success"
                    : s.caseStatus === "Monitoring" ? "text-info"
                    : "text-warning";

    return `
      <tr class="clickable-row" data-student-id="${s.id}">
        <td>
          <div class="student-cell">
            <div class="avatar-initials bg-${r.level}">${ewEsc(s.initials)}</div>
            <div>
              <div class="student-name">${ewEsc(s.name)}</div>
              <div class="student-id">${s.id}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${ewEsc(s.course || "—")}</div>
          <div class="text-muted">${ewEsc(s.section || "—")}</div>
        </td>
        <td>
          <div class="risk-cell">
            <span class="tag tag-${r.level}">${r.label}</span>
            <span class="risk-score">${r.score}</span>
          </div>
        </td>
        <td class="${cls} font-bold">${Number(s.gpa).toFixed(2)}</td>
        <td>${ewAttendanceBar(s.attendance)}</td>
        <td class="${cls} font-bold">${s.missed}</td>
        <td class="${caseClass} font-bold">${ewEsc(s.caseStatus)}</td>
        <td class="text-muted">${ewEsc(s.adviser || "—")}</td>
        <td class="row-actions">
          <button type="button" class="icon-btn" data-action="edit"
                  data-student-id="${s.id}" title="Edit">
            <i data-lucide="pencil"></i>
          </button>
          <button type="button" class="icon-btn icon-danger" data-action="delete"
                  data-student-id="${s.id}" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>`;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

/* ============================================================
   RECORDS PAGE
   ============================================================ */
function ewInitRecordsPage() {
  const tbody   = document.querySelector("table tbody");
  const search  = document.querySelector(".search-box input");
  const filters = document.querySelectorAll(".filter-btn:not([data-action])");
  const sortSel = document.querySelector(".sort-dropdown select");
  const footer  = document.querySelector(".table-footer");

  if (!tbody) return;

  let query = "", level = "all", sortBy = "risk";

  function apply() {
    let rows = EW_DB.students.all();

    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.includes(q) ||
        (s.course  || "").toLowerCase().includes(q) ||
        (s.section || "").toLowerCase().includes(q)
      );
    }

    if (level !== "all") rows = rows.filter(s => EW_RISK.compute(s).level === level);

    const sorters = {
      risk:       (a, b) => EW_RISK.compute(b).score - EW_RISK.compute(a).score,
      course:     (a, b) => (a.course  || "").localeCompare(b.course  || "") ||
                            (a.section || "").localeCompare(b.section || "") ||
                             a.name.localeCompare(b.name),
      gpa:        (a, b) => a.gpa - b.gpa,
      attendance: (a, b) => a.attendance - b.attendance,
      name:       (a, b) => a.name.localeCompare(b.name)
    };
    rows.sort(sorters[sortBy] || sorters.risk);

    ewRenderRecordsTable(tbody, rows);
    if (footer) footer.textContent = `Showing ${rows.length} of ${EW_DB.students.count()} students`;
  }

  if (search) search.addEventListener("input", e => { query = e.target.value.trim(); apply(); });

  filters.forEach(btn => btn.addEventListener("click", () => {
    filters.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.textContent.trim().toLowerCase();
    apply();
  }));

  if (sortSel) sortSel.addEventListener("change", e => {
    const v = e.target.value.toLowerCase();
    sortBy = v.includes("course") ? "course"
           : v.includes("gpa")    ? "gpa"
           : v.includes("attend") ? "attendance"
           : v.includes("name")   ? "name"
           : "risk";
    apply();
  });

  tbody.addEventListener("click", async e => {
    const btn = e.target.closest("[data-action]");
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.studentId;
      const student = EW_DB.students.get(id);
      if (!student) return;

      if (btn.dataset.action === "edit") {
        await ewStudentFormModal(student);
      }
      if (btn.dataset.action === "delete") {
        const alertCount = EW_DB.alerts.for(id).length;
        const ivCount    = EW_DB.interventions.for(id).length;
        const extra = (alertCount || ivCount)
          ? ` This will also remove ${alertCount} alert(s) and ${ivCount} intervention(s).`
          : "";
        const ok = await ewConfirm({
          title: `Delete ${student.name}?`,
          body:  `This cannot be undone.${extra}`,
          confirmLabel: "Delete",
          danger: true
        });
        if (ok) await EW_DB.deleteStudent(id);
      }
      return;
    }

    const row = e.target.closest("tr[data-student-id]");
        if (row) window.location.href = `instructor-student-detail.html?id=${row.dataset.studentId}`;
  });

    /* Skeleton first */
  if (window.EW_SKEL) {
    window.EW_SKEL.tableRows(tbody, 5, {
      cols: [
        { type: "student" },
        { type: "stack", w1: 160, w2: 70 },
        { w: 90 },
        { w: 50 },
        { w: 80 },
        { w: 60 },
        { w: 90 },
        { w: 140 },
        { type: "actions" }
      ]
    });
  }

  Promise.all([
    (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 350))
  ]).then(() => {
    apply();
    tbody.classList.add("skel-reveal");
    EW_DB.subscribe(apply);
  });
}

/* ============================================================
   GLOBAL "ADD STUDENT" HANDLER
   ============================================================ */
(function wireAddStudentButton() {
  if (window.__ewAddStudentWired) return;
  window.__ewAddStudentWired = true;

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-action='add-student']");
    if (!btn) return;
    if (btn.hasAttribute("onclick")) return;
    ewOpenAddStudent(e);
  });
})();

/* ============================================================
   DASHBOARD PAGE
   ============================================================ */
function ewInitDashboardPage() {
  const tbody = document.querySelector("#priorityTable");
  if (!tbody) return;

  function apply() {
    const all = EW_DB.students.all();

    const counts = { critical:0, high:0, medium:0, low:0 };
    let openCases = 0;
    all.forEach(s => {
      const lvl = EW_RISK.compute(s).level;
      counts[lvl] = (counts[lvl] || 0) + 1;
      if (s.caseStatus === "Open") openCases++;
    });

    const setText = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };

    setText("[data-metric='critical']", counts.critical);
    setText("[data-metric='high']",     counts.high);
    setText("[data-metric='medium']",   counts.medium);
    setText("[data-metric='open']",     openCases);

    const total = all.length || 1;
    const setBar = (sel, value) => {
      const el = document.querySelector(sel);
      if (el) el.style.width = Math.round((value / total) * 100) + "%";
    };
    setBar("[data-bar='critical']", counts.critical);
    setBar("[data-bar='high']",     counts.high);
    setBar("[data-bar='medium']",   counts.medium);
    setBar("[data-bar='low']",      counts.low);

    setText("[data-count='critical']", counts.critical);
    setText("[data-count='high']",     counts.high);
    setText("[data-count='medium']",   counts.medium);
    setText("[data-count='low']",      counts.low);

    const priority = all
      .slice()
      .sort((a, b) => EW_RISK.compute(b).score - EW_RISK.compute(a).score)
      .slice(0, 5);

    ewRenderRecordsTable(tbody, priority);
  }

    /* Skeleton for metrics + table + progress widgets */
  if (window.EW_SKEL) {
    window.EW_SKEL.metricCards(document.querySelector(".metrics-grid"), 4);
    window.EW_SKEL.tableRows(
      tbody,
      5,
      { cols: [
        { type: "student" },
        { type: "stack", w1: 160, w2: 70 },
        { w: 90 },
        { w: 50 },
        { w: 60 },
        { w: 60 },
        { w: 90 },
        { w: 140 },
        { type: "actions" }
      ]}
    );
    document.querySelectorAll(".progress-list").forEach(el => {
      window.EW_SKEL.widgetCard(el, 4);
    });
  }

  Promise.all([
    (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 350))
  ]).then(() => {
    apply();
    document.querySelector(".metrics-grid")?.classList.add("skel-reveal");
    tbody.classList.add("skel-reveal");
    document.querySelectorAll(".progress-list").forEach(el => el.classList.add("skel-reveal"));
    EW_DB.subscribe(apply);
  });
}

/* ============================================================
   ALERTS PAGE
   ============================================================ */
function ewInitAlertsPage() {
  const list = document.querySelector("#alertsList");
  if (!list) return;

  let tab = "unread";

  function render() {
    let alerts = EW_DB.alerts.all();
    if (tab === "unread") alerts = alerts.filter(a => !a.acknowledged);
    if (tab === "read")   alerts = alerts.filter(a =>  a.acknowledged);

    alerts.sort((a, b) => b.date.localeCompare(a.date));

    const unreadCount = EW_DB.alerts.unread().length;
    document.querySelectorAll(".tab").forEach(t => {
      if (t.dataset.tab === "unread") t.textContent = `Unread (${unreadCount})`;
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    const ackAllBtn = document.querySelector(".btn-acknowledge-all");
    if (ackAllBtn) {
      ackAllBtn.textContent = `Acknowledge all (${unreadCount})`;
      ackAllBtn.disabled = unreadCount === 0;
    }

    const counts = { critical:0, high:0, medium:0, low:0 };
    alerts.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    document.querySelectorAll("[data-alert-count]").forEach(el => {
      el.textContent = counts[el.dataset.alertCount] || 0;
    });

    if (!alerts.length) {
      list.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">
        No alerts in this view.</div>`;
      return;
    }

    list.innerHTML = alerts.map(a => {
      const student = EW_DB.students.get(a.studentId);
      const name = student ? student.name : "(deleted student)";
      return `
        <div class="alert-card alert-${a.severity}">
          <div class="alert-icon-wrapper">
            <i data-lucide="bell" class="alert-icon"></i>
          </div>
          <div class="alert-content">
            <div class="alert-header">
              <span class="student-name">${ewEsc(name)}</span>
              <span class="alert-tag">${a.severity[0].toUpperCase() + a.severity.slice(1)} · ${ewEsc(a.kind)}</span>
              <span class="alert-date">${a.date}</span>
            </div>
            <p class="alert-message">${ewEsc(a.message)}</p>
          </div>
          ${a.acknowledged
            ? `<span class="text-muted" style="font-size:.72rem;">Acknowledged</span>`
            : `<button class="btn-ack" data-alert-id="${a.id}">Ack.</button>`}
        </div>`;
    }).join("");

    if (window.lucide) lucide.createIcons();
  }

  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-alert-id]");
    if (!btn) return;
    EW_DB.alerts.acknowledge(btn.dataset.alertId);
  });

  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      tab = t.dataset.tab || "unread";
      render();
    });
  });

  const ackAllBtn = document.querySelector(".btn-acknowledge-all");
  if (ackAllBtn) ackAllBtn.addEventListener("click", () => EW_DB.alerts.acknowledgeAll());

    if (window.EW_SKEL) window.EW_SKEL.alertCards(list, 5);

  Promise.all([
    (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 350))
  ]).then(() => {
    render();
    list.classList.add("skel-reveal");
    EW_DB.subscribe(render);
  });
}

/* ============================================================
   INTERVENTIONS PAGE
   ============================================================ */
function ewInitInterventionsPage() {
  const list = document.querySelector("#interventionsList");
  if (!list) return;

  function render() {
    const all = EW_DB.interventions.all()
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    const pending   = all.filter(i => i.status === "pending").length;
    const effective = all.filter(i => i.status === "effective").length;
    const total     = all.length;

    const setText = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
    setText("[data-iv-metric='pending']",   pending);
    setText("[data-iv-metric='effective']", effective);
    setText("[data-iv-metric='total']",     total);

    const titleEl = document.querySelector("[data-iv-title]");
    if (titleEl) titleEl.textContent = `All Interventions (${total})`;

    if (!all.length) {
      list.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">
        No interventions logged yet.</div>`;
      return;
    }

    list.innerHTML = all.map(i => {
      const s = EW_DB.students.get(i.studentId);
      const name = s ? s.name : "(deleted student)";
      const risk = s ? EW_RISK.compute(s) : null;
      return `
        <div class="intervention-card">
          <div class="card-header">
            <div class="student-info">
              <span class="student-name">${ewEsc(name)}</span>
              ${risk ? `<span class="tag tag-${risk.level}">${risk.level}</span>` : ""}
              <div class="student-id">${i.studentId}</div>
            </div>
            <div class="card-badges">
              <span class="type-badge">${ewEsc(i.type)}</span>
              <span class="status-badge status-${i.status}">
                ${i.status === "effective" ? "Effective" : "Pending"}
              </span>
            </div>
          </div>
          <p class="intervention-desc">${ewEsc(i.action)}</p>
          <div class="card-footer">
            ${i.date} · By: ${ewEsc(i.assigned || "—")}
            ${i.deadline ? ` · Follow-up: <strong>${i.deadline}</strong>` : ""}
          </div>
        </div>`;
    }).join("");
  }

    if (window.EW_SKEL) window.EW_SKEL.interventionCards(list, 4);

  Promise.all([
    (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 350))
  ]).then(() => {
    render();
    list.classList.add("skel-reveal");
    EW_DB.subscribe(render);
  });
}

/* ============================================================
   STUDENT SELF-VIEW DASHBOARD
   ============================================================ */
function ewInitStudentDashboard() {
  const root = document.querySelector("#studentRoot");
  if (!root) return;

  function render() {
    const user = ewCurrentUser();
    if (!user || !user.studentId) {
      root.innerHTML = `<p class="text-muted">No student record linked to this account.</p>`;
      return;
    }
    const s = EW_DB.students.get(user.studentId);
    if (!s) {
      root.innerHTML = `<p class="text-muted">Your student record could not be found.</p>`;
      return;
    }

    const risk = EW_RISK.compute(s);

    const bannerEl = document.querySelector("#riskBanner");
    if (bannerEl) {
      bannerEl.className = `risk-banner risk-banner-${risk.level}`;
      bannerEl.querySelector(".risk-title").textContent =
        `You are currently flagged as ${risk.label.toLowerCase()} academic risk`;
      bannerEl.querySelector(".risk-sub").textContent =
        risk.overrides.length
          ? `Triggered by: ${risk.overrides.join(", ")}. Your adviser has been notified.`
          : `Score: ${risk.score}/100. Your adviser has been notified.`;
    }

    const setText = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
    setText("[data-stu='gpa']",        Number(s.gpa).toFixed(2));
    setText("[data-stu='attendance']", s.attendance + "%");
    const passing = s.subjects.filter(x => (x.grade ?? 100) >= 75).length;
    setText("[data-stu='passing']",     `${passing}/${s.subjects.length}`);
    setText("[data-stu='passing-sub']", `${s.subjects.length - passing} at risk`);

    const subjects = document.querySelector("#studentSubjects");
    if (subjects) {
      subjects.innerHTML = s.subjects.map(sub => {
        const fail = sub.grade < 75;
        return `
          <div class="subject-card">
            <div class="subject-top">
              <div class="subject-left">
                <div class="subject-code-row">
                  <span class="subject-code">${sub.code}</span>
                  <span class="status-tag ${fail ? "status-failing" : "status-passing"}">
                    ${fail ? "At Risk" : "Passing"}
                  </span>
                </div>
                <div class="subject-name">${ewEsc(sub.name)}</div>
                <div class="subject-instructor">${ewEsc(sub.instructor || "—")}</div>
              </div>
              <div class="subject-grade ${fail ? "text-danger" : "text-success"}">${sub.grade ?? "—"}</div>
            </div>
            <div class="subject-stats">
              <div class="stat-tile"><div class="stat-value">${sub.prelim ?? "—"}</div><div class="stat-label">Prelim</div></div>
              <div class="stat-tile"><div class="stat-value">${sub.midterm ?? "—"}</div><div class="stat-label">Midterm</div></div>
              <div class="stat-tile"><div class="stat-value">${sub.attendance ?? 0}%</div><div class="stat-label">Attendance</div></div>
            </div>
          </div>`;
      }).join("");
    }
  }

  EW_DB.subscribe(render);
  render();
}

/* ============================================================
   ADMIN STUDENT FORM — edit everything, including credentials
   ============================================================ */
function ewAdminStudentFormModal(existing) {
  const s = existing;
  const v = s;

  /* --- Look up the linked user (for email + password) --- */
  const linkedUser = (function () {
    try {
      return EW_DB.users.all().find(u => u.studentId === s.id) || null;
    } catch (_) { return null; }
  })();

  const currentRiskLevel = (typeof EW_RISK !== "undefined")
    ? EW_RISK.compute(v).level
    : "low";

  const riskLevels = ["critical", "high", "medium", "low"];
  const riskLabels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

  const bodyHTML = `
    <form id="ewAdminStudentForm" novalidate>
      <div class="ew-form-error" hidden></div>

      <!-- ============ Identity ============ -->
      <div class="ew-section-label">Identity</div>
      <div class="ew-form-grid">
        ${ewField("name",    "Full Name",   "text", v.name)}
        ${ewField("id",      "School ID",   "text", v.id, 'maxlength="16"')}
        ${ewField("email",   "Email",       "email", linkedUser ? linkedUser.email : "")}
        ${ewField("password","Password",    "text",  linkedUser ? linkedUser.password : "")}
      </div>

      <!-- ============ Academic ============ -->
      <div class="ew-section-label" style="margin-top:1.1rem;">Academic</div>
      <div class="ew-form-grid">
        ${ewField("course",  "Course",      "text", v.course  || "")}
        ${ewField("section", "Section",     "text", v.section || "")}
        ${ewSelectField("riskLevel", "Risk Level",
              riskLevels.map(l => riskLabels[l]),
              riskLabels[currentRiskLevel])}
        ${ewSelectField("caseStatus", "Case Status",
              ["Open", "In-Progress", "Monitoring", "Resolved"], v.caseStatus)}
        ${ewField("gpa",        "GPA",              "number", v.gpa,        'step="0.01" min="0" max="4"')}
        ${ewField("attendance", "Attendance (%)",   "number", v.attendance, 'min="0" max="100"')}
        ${ewField("missed",     "Missed Activities","number", v.missed,     'min="0"')}
      </div>
    </form>`;

  const footerHTML = `
    <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
    <button type="button" class="ew-btn ew-btn-primary" data-role="save">Save changes</button>`;

  const { overlay, close, closed } = ewShowModal({
    title: `Edit ${v.name}`,
    bodyHTML,
    footerHTML,
    width: 620
  });

  const form    = overlay.querySelector("#ewAdminStudentForm");
  const errBox  = overlay.querySelector(".ew-form-error");
  const saveBtn = overlay.querySelector('[data-role="save"]');

  const idInput    = form.elements["id"];
  const emailInput = form.elements["email"];
  const passInput  = form.elements["password"];
  const gpaInput   = form.elements["gpa"];
  const attInput   = form.elements["attendance"];
  const missInput  = form.elements["missed"];
  const riskSelect = form.elements["riskLevel"];

  /* Auto-format School ID as the admin types */
  if (idInput && typeof ewFormatSchoolIdInput === "function") {
    idInput.addEventListener("input", function () {
      const formatted = ewFormatSchoolIdInput(idInput.value);
      if (formatted !== idInput.value) idInput.value = formatted;
    });
  }

  /* Risk-level presets (same as instructor modal) */
  const RISK_PRESETS = {
    critical: { gpa: 1.60, attendance: 55, missed: 10 },
    high:     { gpa: 2.00, attendance: 68, missed: 6  },
    medium:   { gpa: 2.40, attendance: 80, missed: 3  },
    low:      { gpa: 3.00, attendance: 95, missed: 0  }
  };
  riskSelect.addEventListener("change", () => {
    const key = riskSelect.value.toLowerCase();
    const preset = RISK_PRESETS[key];
    if (!preset) return;
    gpaInput.value  = preset.gpa.toFixed(2);
    attInput.value  = preset.attendance;
    missInput.value = preset.missed;
  });

  overlay.querySelector('[data-role="cancel"]').onclick = () => close(null);

  const showError  = msg => { errBox.textContent = msg; errBox.hidden = false; };
  const clearError = () => { errBox.hidden = true; errBox.textContent = ""; };

  async function save() {
    clearError();

    const newName    = form.elements["name"].value.trim();
    const newId      = idInput.value.trim().toUpperCase();
    const newEmail   = emailInput.value.trim().toLowerCase();
    const newPwd     = passInput.value;
    const course     = form.elements["course"].value.trim();
    const section    = form.elements["section"].value.trim();
    const caseStatus = form.elements["caseStatus"].value;
    const riskLevel  = riskSelect.value.toLowerCase();
    const gpa        = parseFloat(gpaInput.value);
    const attendance = parseInt(attInput.value, 10);
    const missed     = parseInt(missInput.value, 10);

    const errs = [];
    if (!newName) errs.push("Name is required.");

    if (typeof ewValidateSchoolId === "function") {
      const sidCheck = ewValidateSchoolId(newId);
      if (!sidCheck.ok) errs.push(...sidCheck.errors);
    } else if (!newId) {
      errs.push("School ID is required.");
    }

    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      errs.push("Please enter a valid email address.");
    }

    if (newPwd && typeof ewValidatePassword === "function") {
      const pwCheck = ewValidatePassword(newPwd);
      if (!pwCheck.ok) errs.push(...pwCheck.errors);
    }

    if (isNaN(gpa) || gpa < 0 || gpa > 4)
      errs.push("GPA must be between 0 and 4.");
    if (isNaN(attendance) || attendance < 0 || attendance > 100)
      errs.push("Attendance must be between 0 and 100.");
    if (isNaN(missed) || missed < 0)
      errs.push("Missed activities must be a non-negative number.");

    if (errs.length) { showError(errs.join(" ")); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    /* ----- 1) Update the student record (including new ID / name) ----- */
    const studentPatch = {
      name:       newName,
      id:         newId,
      course,
      section,
      caseStatus,
      gpa,
      attendance,
      missed
    };

    /* If the ID changed, we must also update alerts / interventions / user links.
       Easiest path: delete + re-add under the new ID. */
    let updated;
    try {
      if (newId !== s.id) {
        /* Preserve subjects, history, notes */
        const snapshot = {
          ...EW_DB.students.get(s.id),
          ...studentPatch,
          initials: newName.split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("")
        };
        await EW_DB.deleteStudent(s.id);
        const res = await EW_DB.addStudent(snapshot);
        if (!res.ok) throw new Error((res.errors || ["Could not rename student."]).join(" "));
        updated = res.student;
      } else {
        const res = await EW_DB.updateStudent(s.id, studentPatch);
        if (!res.ok) throw new Error((res.errors || ["Could not update student."]).join(" "));
        updated = res.student;
      }
    } catch (err) {
      showError(err.message || "Could not save student record.");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
      return;
    }

    /* ----- 2) Update the linked user account (email + password + ID link) ----- */
    if (linkedUser) {
      try {
        const store = JSON.parse(localStorage.getItem("earlywatch.db.v1") || "{}");
        if (Array.isArray(store.users)) {
          const target = store.users.find(u =>
            u.email.toLowerCase() === linkedUser.email.toLowerCase()
          );
          if (target) {
            /* Uniqueness check when email changes */
            if (newEmail && newEmail !== target.email.toLowerCase()) {
              const clash = store.users.some(u =>
                u.email.toLowerCase() === newEmail && u !== target
              );
              if (clash) {
                showError("Another account already uses that email.");
                saveBtn.disabled = false;
                saveBtn.textContent = "Save changes";
                return;
              }
              target.email = newEmail;
            }
            if (newPwd) target.password = newPwd;
            target.studentId = newId;
            target.name = newName;
            if (target.initials !== undefined) {
              target.initials = newName.split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            }
            localStorage.setItem("earlywatch.db.v1", JSON.stringify(store));
            if (typeof EW_DB.refresh === "function") EW_DB.refresh();
          }
        }
      } catch (err) {
        console.warn("[EarlyWatch] Could not update linked user:", err);
      }
    }

    close(updated);
  }

  saveBtn.onclick = save;
  form.addEventListener("submit", e => { e.preventDefault(); save(); });

  setTimeout(() => form.elements["name"].focus(), 40);

  return closed;
}
window.ewAdminStudentFormModal = ewAdminStudentFormModal;