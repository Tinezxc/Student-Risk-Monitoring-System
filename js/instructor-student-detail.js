/* ============================================================
   EarlyWatch — Instructor Student Detail page
   Tabbed view: Overview / Subjects / Interventions / Alerts
   Depends on: db.js, risk.js, app.js, auth.js
   ============================================================ */

(function () {
  "use strict";

  /* ----- helpers ----- */

  function academicStanding(risk) {
    if (risk.level === "critical") return { text: "Academic Probation Risk", cls: "text-danger" };
    if (risk.level === "high")     return { text: "Needs Close Monitoring",  cls: "text-warning" };
    if (risk.level === "medium")   return { text: "Watch List",              cls: "text-info" };
    return { text: "In Good Standing", cls: "text-success" };
  }

  /* Recommended actions now return { key, label } objects so the
     UI can attach a data-action attribute to each button. */
  function recommendedActions(student, risk) {
    const out = [];

    if (risk.level === "critical" || risk.level === "high") {
      out.push({ key: "counseling",        label: "Schedule immediate counseling session" });
      out.push({ key: "notify-chair",      label: "Notify department chair" });
      out.push({ key: "contact-guardian",  label: "Contact parent or guardian" });
    }
    if (Number(student.gpa) < 1.75) {
      out.push({ key: "review-load",       label: "Review course load feasibility" });
    }
    if (Number(student.attendance) < 75) {
      out.push({ key: "attendance-plan",   label: "Draft attendance recovery plan" });
    }
    if (Number(student.failedSubjects) >= 2) {
      out.push({ key: "academic-plan",     label: "Create academic recovery plan" });
    }
    if (out.length === 0) {
      out.push({ key: "check-in",          label: "Continue regular check-ins" });
      out.push({ key: "celebrate",         label: "Celebrate progress and reinforce good habits" });
    }
    return out;
  }

  /* Map action key → preset for the Log Intervention modal */
  const ACTION_PRESETS = {
    "counseling":        { type: "Counseling",        status: "pending",   days: 7,  action: "Scheduled immediate counseling session" },
    "notify-chair":      { type: "Notification",      status: "pending",   days: 3,  action: "Notified department chair of at-risk status" },
    "contact-guardian":  { type: "Parent Conference", status: "pending",   days: 5,  action: "Contacted parent or guardian to discuss academic status" },
    "review-load":       { type: "Academic Coaching", status: "pending",   days: 10, action: "Reviewed course load feasibility with student" },
    "attendance-plan":   { type: "Attendance Plan",   status: "pending",   days: 7,  action: "Drafted attendance recovery plan" },
    "academic-plan":     { type: "Academic Plan",     status: "pending",   days: 14, action: "Created academic recovery plan" },
    "check-in":          { type: "Check-in",          status: "pending",   days: 14, action: "Routine check-in scheduled" },
    "celebrate":         { type: "Mentoring",         status: "effective", days: 30, action: "Reinforced positive progress and good habits" }
  };

  function subjectBarColor(sub) {
    const grade = Number(sub.grade ?? 0);
    if (grade < 60) return "critical";
    if (grade < 70) return "high";
    if (grade < 75) return "medium";
    return "low";
  }

  function caseStatusClass(status) {
    if (status === "Open") return "is-open";
    if (status === "In-Progress") return "is-progress";
    if (status === "Monitoring") return "is-monitor";
    if (status === "Resolved") return "is-resolved";
    return "";
  }

  function extractYear(section) {
    const m = /Year\s*(\d)/i.exec(section || "");
    return m ? m[1] : "—";
  }

  function todayPlusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return d.toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------
     Toast helper — small feedback message bottom-center
     ------------------------------------------------------------ */
  function showToast(message, variant = "success") {
    const bg = variant === "success"
      ? "rgba(42, 157, 143, 0.95)"
      : variant === "error"
        ? "rgba(230, 57, 70, 0.95)"
        : "rgba(79, 70, 229, 0.95)";

    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText =
      "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);" +
      "background:" + bg + ";color:#fff;padding:.75rem 1.25rem;" +
      "border-radius:8px;font-size:.85rem;font-weight:600;z-index:9999;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.35);" +
      "opacity:0;transition:opacity .2s ease;";
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = "1"; });
    setTimeout(function () {
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 220);
    }, 2200);
  }

  /* ------------------------------------------------------------
     Log Intervention modal — opens with preset values
     ------------------------------------------------------------ */
  async function ewLogIntervention(studentId, preset) {
    preset = preset || {};
    const student = EW_DB.students.get(studentId);
    if (!student) return null;
    const me = ewCurrentUser();

    const defaultDeadline = todayPlusDays(preset.days || 7);
    const types = [
      "Counseling", "Tutoring", "Parent Conference", "Academic Coaching",
      "Attendance Plan", "Academic Plan", "Check-in", "Mentoring", "Notification"
    ];
    const statuses = ["pending", "effective"];

    const bodyHTML = `
      <form id="ewIvForm" novalidate>
        <div class="ew-form-error" hidden></div>
        <div class="ew-form-grid">
          <label class="ew-field">
            <span>Type</span>
            <select name="type">
              ${types.map(function (t) {
                return `<option ${preset.type === t ? "selected" : ""}>${t}</option>`;
              }).join("")}
            </select>
          </label>
          <label class="ew-field">
            <span>Status</span>
            <select name="status">
              ${statuses.map(function (s) {
                return `<option ${preset.status === s ? "selected" : ""}>${s}</option>`;
              }).join("")}
            </select>
          </label>
          <label class="ew-field" style="grid-column:1/-1;">
            <span>Assigned to</span>
            <input type="text" name="assigned"
                   value="${ewEsc(me ? me.name : "")}">
          </label>
          <label class="ew-field" style="grid-column:1/-1;">
            <span>Action / description</span>
            <textarea name="action" rows="3"
              style="width:100%;padding:.6rem .75rem;background:#0d1118;
                     border:1px solid var(--border-color,#232834);
                     border-radius:8px;color:#fff;font-family:inherit;
                     font-size:.85rem;resize:vertical;outline:none;"
            >${ewEsc(preset.action || "")}</textarea>
          </label>
          <label class="ew-field">
            <span>Follow-up date</span>
            <input type="date" name="deadline" value="${defaultDeadline}">
          </label>
        </div>
      </form>`;

    const footerHTML = `
      <button type="button" class="ew-btn ew-btn-ghost" data-role="cancel">Cancel</button>
      <button type="button" class="ew-btn ew-btn-primary" data-role="save">Log intervention</button>`;

    const ref = ewShowModal({
      title: "Log intervention · " + student.name,
      bodyHTML: bodyHTML,
      footerHTML: footerHTML,
      width: 560
    });
    const overlay = ref.overlay;
    const close   = ref.close;
    const closed  = ref.closed;

    const form    = overlay.querySelector("#ewIvForm");
    const errBox  = overlay.querySelector(".ew-form-error");
    const saveBtn = overlay.querySelector('[data-role="save"]');

    overlay.querySelector('[data-role="cancel"]').onclick = function () { close(null); };

    async function save() {
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.action.trim()) {
        errBox.textContent = "Please describe the action.";
        errBox.hidden = false;
        return;
      }
      errBox.hidden = true;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      await EW_DB.interventions.add({
        studentId: studentId,
        type:      data.type,
        status:    data.status,
        assigned:  data.assigned,
        action:    data.action,
        deadline:  data.deadline || null
      });

      close(true);
    }

    saveBtn.onclick = save;
    form.addEventListener("submit", function (e) { e.preventDefault(); save(); });

    return closed;
  }

  /* ------------------------------------------------------------
     Quick action dispatcher — called when an action button clicks
     ------------------------------------------------------------ */
  async function ewQuickAction(studentId, key) {
    const preset = ACTION_PRESETS[key] || {
      type: "Counseling", status: "pending", days: 7,
      action: "Follow-up from recommended actions"
    };
    const ok = await ewLogIntervention(studentId, preset);
    if (ok) showToast("✓ Intervention logged");
  }

  /* ----- page init ----- */
  window.ewInitInstructorStudentDetail = function () {
    const root = document.getElementById("studentDetailRoot");
    const id = new URLSearchParams(location.search).get("id");

    if (window.EW_SKEL) window.EW_SKEL.detailPage(root);

    let activeTab = "overview";

    function render() {
      const student = id ? EW_DB.students.get(id) : null;

      if (!student) {
        root.innerHTML = `<div class="empty-state">
          <h2>Student not found</h2>
          <p class="text-muted">No student matches <code>${ewEsc(id || "(no id)")}</code>.</p>
          <a class="detail-back" href="instructor-student-records.html">← Back to Student Records</a>
        </div>`;
        if (window.lucide) lucide.createIcons();
        return;
      }

      const risk = EW_RISK.compute(student);
      const alerts = EW_DB.alerts.for(student.id);
      const interventions = EW_DB.interventions.for(student.id);

      const lastAlert  = alerts.length ? alerts.slice().sort(function (a, b) { return b.date.localeCompare(a.date); })[0] : null;
      const lastDate   = lastAlert ? lastAlert.date : "—";
      const openAlerts = alerts.filter(function (a) { return !a.acknowledged; }).length;

      const standing = academicStanding(risk);
      const actions  = recommendedActions(student, risk);

      /* ---------- Tab contents ---------- */

      const overviewHTML = `
        <div class="detail-two-col">
          <section class="panel">
            <h3 class="panel-kicker">Risk Indicators</h3>
            <div class="risk-row">
              <span>Overall Risk Score</span>
              <span class="risk-row-val ${risk.level === 'critical' ? 'text-danger'
                                       : risk.level === 'high'   ? 'text-warning'
                                       : risk.level === 'medium' ? 'text-info'
                                       : 'text-success'}">
                ${risk.score}/100
              </span>
            </div>
            <div class="risk-row">
              <span>Academic Standing</span>
              <span class="risk-row-val ${standing.cls}">${standing.text}</span>
            </div>
            <div class="risk-row">
              <span>Subjects Failing</span>
              <span class="risk-row-val ${student.failedSubjects ? 'text-danger' : 'text-success'}">
                ${student.failedSubjects} of ${student.subjects.length || 0}
              </span>
            </div>
            <div class="risk-row">
              <span>Overall Attendance</span>
              <span class="risk-row-val ${student.attendance < 60 ? 'text-danger'
                                       : student.attendance < 75 ? 'text-warning'
                                       : 'text-success'}">
                ${student.attendance}%
              </span>
            </div>
            <div class="risk-row">
              <span>Missed Assignments</span>
              <span class="risk-row-val ${student.missed >= 8 ? 'text-danger'
                                       : student.missed >= 4 ? 'text-warning'
                                       : ''}">
                ${student.missed}
              </span>
            </div>
          </section>

          <section class="panel">
            <h3 class="panel-kicker">Recommended Actions</h3>
            <ul class="action-list">
              ${actions.map(function (a) {
                return `
                  <li>
                    <button type="button" class="action-item"
                            data-action="${ewEsc(a.key)}">
                      <i data-lucide="arrow-right"></i>
                      <span>${ewEsc(a.label)}</span>
                    </button>
                  </li>`;
              }).join("")}
            </ul>
          </section>
        </div>

        <section class="panel">
          <h3 class="panel-kicker">Subject Performance Summary</h3>
          ${student.subjects.length ? student.subjects.map(function (sub) {
            const grade = Number(sub.grade ?? 0);
            const color = subjectBarColor(sub);
            return `
              <div class="subject-bar-row">
                <div class="subject-bar-meta">
                  <div class="subject-bar-code">${ewEsc(sub.code)}</div>
                  <div class="subject-bar-sub">${sub.attendance ?? 0}% attend.</div>
                </div>
                <div class="subject-bar-track">
                  <div class="subject-bar-fill ${color}" style="width:${Math.max(4, Math.min(100, grade))}%">
                    <span>${grade}</span>
                  </div>
                </div>
                <div class="subject-bar-status ${grade < 75 ? 'text-warning' : 'text-success'}">
                  ${grade < 75 ? "Failing" : "Passing"}
                </div>
              </div>`;
          }).join("") : `<p class="text-muted">No subject data recorded.</p>`}
        </section>
      `;

      const subjectsHTML = `
        <section class="panel">
          <h3 class="panel-kicker">All Subjects</h3>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Subject</th><th>Instructor</th>
                  <th>Prelim</th><th>Midterm</th><th>Grade</th>
                  <th>Attendance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${student.subjects.length ? student.subjects.map(function (sub) {
                  const fail = sub.grade < 75;
                  return `
                    <tr>
                      <td><strong>${ewEsc(sub.code)}</strong></td>
                      <td>${ewEsc(sub.name)}</td>
                      <td class="text-muted">${ewEsc(sub.instructor || "—")}</td>
                      <td>${sub.prelim ?? "—"}</td>
                      <td>${sub.midterm ?? "—"}</td>
                      <td class="font-bold ${fail ? 'text-danger' : 'text-success'}">${sub.grade ?? "—"}</td>
                      <td>${sub.attendance ?? 0}%</td>
                      <td class="${fail ? 'text-danger' : 'text-success'}">${fail ? "Failing" : "Passing"}</td>
                    </tr>`;
                }).join("") : `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:1.5rem;">No subject data.</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      `;

      const interventionsHTML = `
        <section class="panel">
          <h3 class="panel-kicker">Interventions (${interventions.length})</h3>
          ${interventions.length ? interventions.map(function (i) {
            return `
              <div class="detail-list-card">
                <div class="detail-list-head">
                  <span class="type-badge">${ewEsc(i.type)}</span>
                  <span class="status-badge status-${i.status}">
                    ${i.status === "effective" ? "Effective" : "Pending"}
                  </span>
                  <span class="detail-list-date">${i.date}</span>
                </div>
                <p class="detail-list-body">${ewEsc(i.action)}</p>
                <div class="detail-list-meta">
                  Assigned: <strong>${ewEsc(i.assigned || "—")}</strong>
                  ${i.deadline ? ` · Follow-up: <strong>${i.deadline}</strong>` : ""}
                </div>
              </div>`;
          }).join("") : `<p class="text-muted">No interventions logged yet. Use the Recommended Actions on the Overview tab to log one.</p>`}
        </section>
      `;

      const alertsHTML = `
        <section class="panel">
          <h3 class="panel-kicker">Alerts (${alerts.length})</h3>
          ${alerts.length ? alerts.map(function (a) {
            return `
              <div class="detail-list-card">
                <div class="detail-list-head">
                  <span class="mini-sev ${a.severity}">${a.severity.toUpperCase()}</span>
                  <span>${ewEsc(a.kind)}</span>
                  <span class="detail-list-date">${a.date}</span>
                </div>
                <p class="detail-list-body">${ewEsc(a.message)}</p>
                ${a.acknowledged
                  ? `<div class="detail-list-meta text-muted">Acknowledged</div>`
                  : `<div class="detail-list-meta text-warning">Unacknowledged</div>`}
              </div>`;
          }).join("") : `<p class="text-muted">No alerts for this student.</p>`}
        </section>
      `;

      /* ---------- Layout ---------- */

      const tabs = [
        { key: "overview",      label: "Overview" },
        { key: "subjects",      label: "Subjects" },
        { key: "interventions", label: "Interventions", count: interventions.length },
        { key: "alerts",        label: "Alerts", count: openAlerts }
      ];

      const tabContent =
        activeTab === "overview"      ? overviewHTML :
        activeTab === "subjects"      ? subjectsHTML :
        activeTab === "interventions" ? interventionsHTML :
                                        alertsHTML;

      root.innerHTML = `
        <a class="detail-back" href="instructor-student-records.html">
          <i data-lucide="arrow-left"></i> Back to Records
        </a>

        <header class="detail-header">
          <div class="detail-header-left">
            <div class="detail-avatar ${risk.level}">${ewEsc(student.initials)}</div>
            <div class="detail-identity">
              <div class="detail-name-row">
                <h1>${ewEsc(student.name)}</h1>
                <span class="detail-pill detail-pill-risk ${risk.level}">
                  ${risk.label} Risk · ${risk.score}/100
                </span>
                <span class="detail-pill detail-pill-case ${caseStatusClass(student.caseStatus)}">
                  ${ewEsc(student.caseStatus)}
                </span>
              </div>
              <div class="detail-meta-row">
                <span>${ewEsc(student.id)}</span>
                <span class="dot">·</span>
                <span>${ewEsc(student.course || "—")}</span>
                <span class="dot">·</span>
                <span>${ewEsc(student.section || "—")}</span>
                <span class="dot">·</span>
                <span>Year ${extractYear(student.section)}</span>
              </div>
              <div class="detail-meta-row detail-meta-small">
                <span>Last contact: <strong>${lastDate}</strong></span>
                <span>Interventions: <strong>${interventions.length}</strong></span>
                <span>Open alerts: <strong>${openAlerts}</strong></span>
              </div>
            </div>
          </div>

          <div class="detail-header-stats">
            <div class="detail-stat">
              <div class="detail-stat-val ${student.gpa < 1.75 ? 'text-danger' : student.gpa < 2.5 ? 'text-warning' : ''}">
                ${Number(student.gpa).toFixed(2)}
              </div>
              <div class="detail-stat-lbl">GPA</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-val ${student.attendance < 60 ? 'text-danger'
                                            : student.attendance < 75 ? 'text-warning'
                                            : ''}">
                ${student.attendance}%
              </div>
              <div class="detail-stat-lbl">Attendance</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-val ${student.missed >= 8 ? 'text-danger' : student.missed >= 4 ? 'text-warning' : ''}">
                ${student.missed}
              </div>
              <div class="detail-stat-lbl">Missed</div>
            </div>
          </div>
        </header>

        <nav class="detail-tabs">
          ${tabs.map(function (t) {
            return `
              <button type="button" class="detail-tab ${t.key === activeTab ? 'active' : ''}"
                      data-tab="${t.key}">
                ${t.label}
                ${t.count ? `<span class="detail-tab-badge">${t.count}</span>` : ""}
              </button>`;
          }).join("")}
        </nav>

        <div class="detail-tab-panel">
          ${tabContent}
        </div>
      `;

      /* Tab switching */
      root.querySelectorAll(".detail-tab").forEach(function (btn) {
        btn.addEventListener("click", function () {
          activeTab = btn.dataset.tab || "overview";
          render();
        });
      });

      /* ---- Recommended Action click handlers ---- */
      root.querySelectorAll(".action-item").forEach(function (btn) {
        btn.addEventListener("click", async function (e) {
          e.preventDefault();
          e.stopPropagation();
          const key = btn.dataset.action || "";
          if (!key) return;
          btn.disabled = true;
          try {
            await ewQuickAction(student.id, key);
          } finally {
            btn.disabled = false;
          }
        });
      });

      if (window.lucide) lucide.createIcons();
      if (typeof ewPaintUser === "function") ewPaintUser();
    }

    Promise.all([
      (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
      new Promise(function (r) { setTimeout(r, 300); })
    ]).then(function () {
      render();
      root.classList.add("skel-reveal");
      EW_DB.subscribe(render);
    });
  };
})();