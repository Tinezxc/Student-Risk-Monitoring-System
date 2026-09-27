/* ============================================================
   EarlyWatch — Admin page logic
   Depends on: db.js, risk.js, app.js, auth.js
   ============================================================ */

/* ------------------------------------------------------------
   Shared sidebar helper (all admin pages use the same markup)
   ------------------------------------------------------------ */
function ewAdminPaintChrome(activePage) {
  const links = [
    {
      key: "dashboard",
      href: "admin-dashboard.html",
      icon: "layout-grid",
      label: "Dashboard",
    },
    {
      key: "records",
      href: "admin-records.html",
      icon: "users",
      label: "Student Records",
    },
    {
      key: "alerts",
      href: "admin-alerts.html",
      icon: "bell",
      label: "Alerts",
      badge: true,
    },
  ];

  const nav = document.getElementById("adminNav");
  if (nav) {
    nav.innerHTML = links
      .map(
        (l) => `
      <a href="${l.href}" class="nav-item ${l.key === activePage ? "active" : ""}">
        <i data-lucide="${l.icon}"></i><span>${l.label}</span>
        ${l.badge ? `<span class="badge red" id="navAlertCount">0</span>` : ""}
      </a>`,
      )
      .join("");
  }

  const badge = document.getElementById("navAlertCount");
  if (badge) badge.textContent = EW_DB.alerts.unread().length;

  if (window.lucide) lucide.createIcons();
}

/* ------------------------------------------------------------
   ADMIN DASHBOARD
   ------------------------------------------------------------ */
function ewInitAdminDashboard() {
  const setText = (sel, v) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = v;
  };
  const setBar = (sel, pct) => {
    const el = document.querySelector(sel);
    if (el) el.style.width = Math.max(0, Math.min(100, pct)) + "%";
  };

  function render() {
    const t = EW_DB.admin.totals();

    /* Top metric cards */
    setText("[data-admin='students']", t.students);
    setText("[data-admin='critical']", t.levels.critical);
    setText("[data-admin='high']", t.levels.high);
    setText("[data-admin='open']", t.openCases);
    setText("[data-admin='alerts']", t.unreadAlerts);
    setText("[data-admin='interventions']", t.totalInterventions);

    setText("[data-admin='avgGpa']", Number(t.avgGpa).toFixed(2));
    setText("[data-admin='avgAttendance']", Math.round(t.avgAttendance) + "%");

    /* Risk distribution */
    const total = t.students || 1;
    setText("[data-dist='critical']", t.levels.critical);
    setText("[data-dist='high']", t.levels.high);
    setText("[data-dist='medium']", t.levels.medium);
    setText("[data-dist='low']", t.levels.low);
    setBar("[data-bar='critical']", (t.levels.critical / total) * 100);
    setBar("[data-bar='high']", (t.levels.high / total) * 100);
    setBar("[data-bar='medium']", (t.levels.medium / total) * 100);
    setBar("[data-bar='low']", (t.levels.low / total) * 100);

    /* Case status */
    setText("[data-case='open']", t.openCases);
    setText(
      "[data-case='inprogress']",
      t.students - t.openCases - t.monitoringCases - t.resolvedCases >= 0
        ? Math.max(
            0,
            t.students - t.openCases - t.monitoringCases - t.resolvedCases,
          )
        : 0,
    );
    setText("[data-case='monitoring']", t.monitoringCases);
    setText("[data-case='resolved']", t.resolvedCases);

    /* Intervention status */
    setText("[data-iv='pending']", t.interventionsByStatus.pending);
    setText("[data-iv='effective']", t.interventionsByStatus.effective);

    /* Course breakdown */
    const courseGrid = document.getElementById("courseGrid");
    if (courseGrid) {
      const rows = EW_DB.admin.byCourse();
      courseGrid.innerHTML = rows.length
        ? rows
            .map(
              (r) => `
            <div class="course-card">
              <h4>${ewEsc(r.course)}</h4>
              <div class="course-count">${r.count} student${r.count === 1 ? "" : "s"}</div>
              <div class="course-stats">
                <div class="stat-block"><strong>${Number(r.avgGpa).toFixed(2)}</strong><span>Avg GPA</span></div>
                <div class="stat-block"><strong>${Math.round(r.avgAttendance)}%</strong><span>Attendance</span></div>
                <div class="stat-block"><strong class="text-danger">${r.critical}</strong><span>Critical</span></div>
                <div class="stat-block"><strong class="text-warning">${r.high}</strong><span>High</span></div>
              </div>
            </div>`,
            )
            .join("")
        : `<p class="text-muted">No data.</p>`;
    }

    /* Recent activity */
    const feed = document.getElementById("activityFeed");
    if (feed) {
      const items = EW_DB.admin.recentActivity(8);
      feed.innerHTML = items.length
        ? items
            .map(
              (a) => `
            <div class="activity-item">
              <div class="activity-icon"><i data-lucide="${a.icon}"></i></div>
              <div class="activity-content">
                <div class="activity-text">${ewEsc(a.text)}</div>
                <div class="activity-time">${ewEsc(a.date)}</div>
              </div>
            </div>`,
            )
            .join("")
        : `<p class="text-muted">No recent activity.</p>`;
    }

    /* Top at-risk students table */
    const tbody = document.getElementById("topRiskTable");
    if (tbody) {
      const list = EW_DB.students
        .all()
        .slice()
        .sort((a, b) => EW_RISK.compute(b).score - EW_RISK.compute(a).score)
        .slice(0, 6);

      tbody.innerHTML = list
        .map((s) => {
          const r = EW_RISK.compute(s);
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
              <div class="text-muted" style="font-size:.72rem;">${ewEsc(s.section || "—")}</div>
            </td>
            <td><span class="tag tag-${r.level}">${r.label}</span> <span class="risk-score">${r.score}</span></td>
            <td class="font-bold">${Number(s.gpa).toFixed(2)}</td>
            <td>${s.attendance}%</td>
            <td>${ewEsc(s.caseStatus)}</td>
          </tr>`;
        })
        .join("");

      tbody.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-student-id]");
        if (row)
          window.location.href = `admin-student.html?id=${row.dataset.studentId}`;
      });
    }

    if (window.lucide) lucide.createIcons();
    ewPaintUser();
  }

  EW_DB.subscribe(render);
  (async function () {
    await ewMinDelay(220);
    render();
  })();
}

/* ------------------------------------------------------------
   ADMIN RECORDS
   ------------------------------------------------------------ */
function ewInitAdminRecords() {
  const tbody = document.getElementById("adminRecordsBody");
  if (!tbody) return;

  const search = document.querySelector(".search-box input");
  const filters = document.querySelectorAll(".filter-btn:not([data-action])");
  const sortSel = document.querySelector(".sort-dropdown select");
  const footer = document.querySelector(".table-footer");

  let query = "",
    level = "all",
    sortBy = "risk";

  function render() {
    let rows = EW_DB.students.all();

    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.includes(q) ||
          (s.course || "").toLowerCase().includes(q) ||
          (s.section || "").toLowerCase().includes(q) ||
          (s.adviser || "").toLowerCase().includes(q),
      );
    }

    if (level !== "all")
      rows = rows.filter((s) => EW_RISK.compute(s).level === level);

    const sorters = {
      risk: (a, b) => EW_RISK.compute(b).score - EW_RISK.compute(a).score,
      gpa: (a, b) => a.gpa - b.gpa,
      attendance: (a, b) => a.attendance - b.attendance,
      name: (a, b) => a.name.localeCompare(b.name),
      course: (a, b) =>
        (a.course || "").localeCompare(b.course || "") ||
        (a.section || "").localeCompare(b.section || ""),
    };
    rows.sort(sorters[sortBy] || sorters.risk);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:2rem;">
        No students match your filters.</td></tr>`;
    } else {
      tbody.innerHTML = rows
        .map((s) => {
          const r = EW_RISK.compute(s);
          const caseClass =
            s.caseStatus === "Open"
              ? "text-danger"
              : s.caseStatus === "Resolved"
                ? "text-success"
                : s.caseStatus === "Monitoring"
                  ? "text-info"
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
              <div class="text-muted" style="font-size:.72rem;">${ewEsc(s.section || "—")}</div>
            </td>
            <td><span class="tag tag-${r.level}">${r.label}</span> <span class="risk-score">${r.score}</span></td>
            <td class="font-bold">${Number(s.gpa).toFixed(2)}</td>
            <td>${s.attendance}%</td>
            <td>${s.missed}</td>
            <td class="${caseClass} font-bold">${ewEsc(s.caseStatus)}</td>
            <td class="text-muted">${ewEsc(s.adviser || "—")}</td>
          </tr>`;
        })
        .join("");
    }

    if (footer)
      footer.textContent = `Showing ${rows.length} of ${EW_DB.students.count()} students`;
    if (window.lucide) lucide.createIcons();
  }

  if (search)
    search.addEventListener("input", (e) => {
      query = e.target.value.trim();
      render();
    });

  filters.forEach((btn) =>
    btn.addEventListener("click", () => {
      filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      level = btn.textContent.trim().toLowerCase();
      render();
    }),
  );

  if (sortSel)
    sortSel.addEventListener("change", (e) => {
      const v = e.target.value.toLowerCase();
      sortBy = v.includes("gpa")
        ? "gpa"
        : v.includes("attend")
          ? "attendance"
          : v.includes("name")
            ? "name"
            : v.includes("course")
              ? "course"
              : "risk";
      render();
    });

  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-student-id]");
    if (row)
      window.location.href = `admin-student.html?id=${row.dataset.studentId}`;
  });

  EW_DB.subscribe(render);
  render();
}

/* ------------------------------------------------------------
   ADMIN STUDENT DETAIL
   ------------------------------------------------------------ */
function ewInitAdminStudent() {
  const root = document.getElementById("adminStudentRoot");
  const id = new URLSearchParams(location.search).get("id");
  if (!root) return;

  function render() {
    const bundle = id ? EW_DB.admin.studentDetail(id) : null;

    if (!bundle) {
      root.innerHTML = `<div class="empty-state">
        <h2>Student not found</h2>
        <p class="text-muted">No student matches <code>${ewEsc(id || "(no id)")}</code>.</p>
        <a class="btn-back" href="admin-records.html">← Back to Student Records</a>
      </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const { student: s, risk, alerts, interventions } = bundle;

    const subjectRows = s.subjects.length
      ? s.subjects
          .map((sub) => {
            const fail = sub.grade < 75;
            return `
            <tr class="subject-row">
              <td><strong>${ewEsc(sub.code)}</strong></td>
              <td>
                <div>${ewEsc(sub.name)}</div>
                <div class="text-muted" style="font-size:.72rem;">${ewEsc(sub.instructor || "—")}</div>
              </td>
              <td>${sub.prelim ?? "—"}</td>
              <td>${sub.midterm ?? "—"}</td>
              <td class="font-bold ${fail ? "text-danger" : "text-success"}">${sub.grade ?? "—"}</td>
              <td>${sub.attendance ?? 0}%</td>
              <td class="${fail ? "status-failing" : "status-passing"}">${fail ? "Failing" : "Passing"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:1.5rem;">No subject data.</td></tr>`;

    const alertItems = alerts.length
      ? alerts
          .map(
            (a) => `
          <div class="mini-card">
            <div class="mini-card-head">
              <span class="mini-sev ${a.severity}">${a.severity.toUpperCase()}</span>
              <span>${ewEsc(a.kind)}</span>
              <span style="margin-left:auto;">${a.date}</span>
            </div>
            <div class="mini-card-body">${ewEsc(a.message)}</div>
          </div>`,
          )
          .join("")
      : `<p class="text-muted">No alerts.</p>`;

    const ivItems = interventions.length
      ? interventions
          .map(
            (i) => `
          <div class="mini-card">
            <div class="mini-card-head">
              <span>${ewEsc(i.type)}</span>
              <span style="margin-left:auto;">${i.date}</span>
            </div>
            <div class="mini-card-body">${ewEsc(i.action)}</div>
            <div class="text-muted" style="font-size:.7rem;margin-top:.35rem;">
              Status: <strong>${i.status}</strong> · Assigned: ${ewEsc(i.assigned || "—")}
              ${i.deadline ? ` · Follow-up: ${i.deadline}` : ""}
            </div>
          </div>`,
          )
          .join("")
      : `<p class="text-muted">No interventions.</p>`;

    const noteItems = s.notes.length
      ? s.notes
          .map(
            (n) => `
          <div class="mini-card">
            <div class="mini-card-head">${n.date} · ${ewEsc(n.author)}</div>
            <div class="mini-card-body">${ewEsc(n.text)}</div>
          </div>`,
          )
          .join("")
      : `<p class="text-muted">No notes.</p>`;

    root.innerHTML = `
      <header class="header profile-header">
        <a class="btn-back" href="admin-records.html">
          <i data-lucide="arrow-left"></i> Back
        </a>
        <div class="profile-identity">
          <div class="avatar-initials bg-${risk.level} avatar-lg">${ewEsc(s.initials)}</div>
          <div>
            <h1>${ewEsc(s.name)}</h1>
            <p class="subtitle">${s.id} · ${ewEsc(s.course || "—")} · ${ewEsc(s.section || "—")} · Adviser: ${ewEsc(s.adviser || "—")}</p>
          </div>
        </div>
        <div class="risk-hero risk-hero-${risk.level}">
          <div class="risk-hero-score">${risk.score}</div>
          <div class="risk-hero-label">${risk.label} Risk</div>
        </div>
      </header>

      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${Number(s.gpa).toFixed(2)}</div>
          <div class="metric-label">GPA</div>
          <div class="metric-sub">Current term</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${s.attendance}%</div>
          <div class="metric-label">Attendance</div>
          <div class="metric-sub">Across all subjects</div>
        </div>
        <div class="metric-card">
          <div class="metric-value ${s.missed >= 8 ? "text-danger" : s.missed >= 4 ? "text-warning" : ""}">${s.missed}</div>
          <div class="metric-label">Missed Activities</div>
          <div class="metric-sub">This term</div>
        </div>
        <div class="metric-card">
          <div class="metric-value ${s.failedSubjects ? "text-danger" : "text-success"}">${s.failedSubjects}</div>
          <div class="metric-label">Failed Subjects</div>
          <div class="metric-sub">${ewEsc(s.caseStatus)} case</div>
        </div>
      </section>

      <div class="profile-grid">
        <section class="panel">
          <h3><i data-lucide="user"></i> Student Information</h3>
          <div class="info-list">
            <div class="info-row"><span class="info-label">Student ID</span><span class="info-value">${s.id}</span></div>
            <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${ewEsc(s.name)}</span></div>
            <div class="info-row"><span class="info-label">Course</span><span class="info-value">${ewEsc(s.course || "—")}</span></div>
            <div class="info-row"><span class="info-label">Section</span><span class="info-value">${ewEsc(s.section || "—")}</span></div>
            <div class="info-row"><span class="info-label">Adviser</span><span class="info-value">${ewEsc(s.adviser || "—")}</span></div>
            <div class="info-row"><span class="info-label">Case Status</span><span class="info-value">${ewEsc(s.caseStatus)}</span></div>
          </div>
        </section>

        <section class="panel">
          <h3><i data-lucide="bar-chart-3"></i> Risk Breakdown</h3>
          <div class="progress-list">
            ${risk.breakdown
              .map(
                (b) => `
              <div>
                <div class="progress-label"><span>${b.label}</span><span>${b.weighted} pts</span></div>
                <div class="progress-bar">
                  <div class="fill ${risk.level}" style="width:${b.raw}%"></div>
                </div>
              </div>`,
              )
              .join("")}
          </div>
          ${
            risk.overrides.length
              ? `<p class="text-warning" style="margin-top:1rem;font-size:.78rem;">
                 Escalated by rule: ${risk.overrides.join(", ")}
               </p>`
              : ""
          }
        </section>

        <section class="panel panel-full">
          <h3><i data-lucide="book-open"></i> Subject Breakdown</h3>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Subject</th><th>Prelim</th><th>Midterm</th>
                  <th>Grade</th><th>Attendance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>${subjectRows}</tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <h3><i data-lucide="bell"></i> Alerts (${alerts.length})</h3>
          <div class="mini-list">${alertItems}</div>
        </section>

        <section class="panel">
          <h3><i data-lucide="clipboard-list"></i> Interventions (${interventions.length})</h3>
          <div class="mini-list">${ivItems}</div>
        </section>

        <section class="panel panel-full">
          <h3><i data-lucide="file-text"></i> Adviser Notes</h3>
          <div class="mini-list">${noteItems}</div>
        </section>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    ewPaintUser();
  }

  EW_DB.subscribe(render);
  render();
}

/* ------------------------------------------------------------
   ADMIN ALERTS
   ------------------------------------------------------------ */
function ewInitAdminAlerts() {
  const list = document.getElementById("adminAlertsList");
  if (!list) return;

  let tab = "unread";

  function render() {
    let alerts = EW_DB.alerts.all();
    if (tab === "unread") alerts = alerts.filter((a) => !a.acknowledged);
    if (tab === "read") alerts = alerts.filter((a) => a.acknowledged);
    alerts.sort((a, b) => b.date.localeCompare(a.date));

    const unreadCount = EW_DB.alerts.unread().length;

    document.querySelectorAll(".tab").forEach((t) => {
      if (t.dataset.tab === "unread") t.textContent = `Unread (${unreadCount})`;
      t.classList.toggle("active", t.dataset.tab === tab);
    });

    const ackBtn = document.querySelector(".btn-acknowledge-all");
    if (ackBtn) {
      ackBtn.textContent = `Acknowledge all (${unreadCount})`;
      ackBtn.disabled = unreadCount === 0;
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    alerts.forEach((a) => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    document.querySelectorAll("[data-alert-count]").forEach((el) => {
      el.textContent = counts[el.dataset.alertCount] || 0;
    });

    if (!alerts.length) {
      list.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">No alerts in this view.</div>`;
      return;
    }

    list.innerHTML = alerts
      .map((a) => {
        const s = EW_DB.students.get(a.studentId);
        const name = s ? s.name : "(deleted student)";
        return `
        <div class="mini-card" style="border-left:3px solid var(--color-${a.severity});">
          <div class="mini-card-head">
            <span class="mini-sev ${a.severity}">${a.severity.toUpperCase()}</span>
            <span>${ewEsc(a.kind)}</span>
            <span>·</span>
            <a href="admin-student.html?id=${a.studentId}" style="color:#7c76ff;text-decoration:none;">${ewEsc(name)}</a>
            <span style="margin-left:auto;">${a.date}</span>
          </div>
          <div class="mini-card-body">${ewEsc(a.message)}</div>
          <div style="margin-top:.5rem;">
            ${
              a.acknowledged
                ? `<span class="text-muted" style="font-size:.72rem;">Acknowledged</span>`
                : `<button class="filter-btn" data-alert-id="${a.id}" style="background:#1f2736;">Acknowledge</button>`
            }
          </div>
        </div>`;
      })
      .join("");

    if (window.lucide) lucide.createIcons();
  }

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-alert-id]");
    if (!btn) return;
    EW_DB.alerts.acknowledge(btn.dataset.alertId);
  });

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      tab = t.dataset.tab || "unread";
      render();
    });
  });

  const ackBtn = document.querySelector(".btn-acknowledge-all");
  if (ackBtn)
    ackBtn.addEventListener("click", () => EW_DB.alerts.acknowledgeAll());

  EW_DB.subscribe(render);
  render();
}

/* ------------------------------------------------------------
   ADMIN ALERTS
   ------------------------------------------------------------ */
function ewInitAdminAlerts() {
  const list = document.getElementById("adminAlertsList");
  if (!list) return;

  let tab = "unread";

  function render() {
    let alerts = EW_DB.alerts.all();
    if (tab === "unread") alerts = alerts.filter((a) => !a.acknowledged);
    if (tab === "read") alerts = alerts.filter((a) => a.acknowledged);
    alerts.sort((a, b) => b.date.localeCompare(a.date));

    const unreadCount = EW_DB.alerts.unread().length;

    document.querySelectorAll(".tab").forEach((t) => {
      if (t.dataset.tab === "unread") t.textContent = `Unread (${unreadCount})`;
      t.classList.toggle("active", t.dataset.tab === tab);
    });

    const ackBtn = document.querySelector(".btn-acknowledge-all");
    if (ackBtn) {
      ackBtn.textContent = `Acknowledge all (${unreadCount})`;
      ackBtn.disabled = unreadCount === 0;
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    alerts.forEach((a) => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    document.querySelectorAll("[data-alert-count]").forEach((el) => {
      el.textContent = counts[el.dataset.alertCount] || 0;
    });

    if (!alerts.length) {
      list.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">No alerts in this view.</div>`;
      return;
    }

    list.innerHTML = alerts
      .map((a) => {
        const s = EW_DB.students.get(a.studentId);
        const name = s ? s.name : "(deleted student)";
        return `
        <div class="mini-card" style="border-left:3px solid var(--color-${a.severity});">
          <div class="mini-card-head">
            <span class="mini-sev ${a.severity}">${a.severity.toUpperCase()}</span>
            <span>${ewEsc(a.kind)}</span>
            <span>·</span>
            <a href="admin-student.html?id=${a.studentId}" style="color:#7c76ff;text-decoration:none;">${ewEsc(name)}</a>
            <span style="margin-left:auto;">${a.date}</span>
          </div>
          <div class="mini-card-body">${ewEsc(a.message)}</div>
          <div style="margin-top:.5rem;">
            ${
              a.acknowledged
                ? `<span class="text-muted" style="font-size:.72rem;">Acknowledged</span>`
                : `<button class="filter-btn" data-alert-id="${a.id}" style="background:#1f2736;">Acknowledge</button>`
            }
          </div>
        </div>`;
      })
      .join("");

    if (window.lucide) lucide.createIcons();
  }

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-alert-id]");
    if (!btn) return;
    EW_DB.alerts.acknowledge(btn.dataset.alertId);
  });

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      tab = t.dataset.tab || "unread";
      render();
    });
  });

  const ackBtn = document.querySelector(".btn-acknowledge-all");
  if (ackBtn)
    ackBtn.addEventListener("click", () => EW_DB.alerts.acknowledgeAll());

  EW_DB.subscribe(render);
  render();
}

/* ------------------------------------------------------------
   ADMIN RECORDS — read-only list of registered students
   ------------------------------------------------------------ */
function ewInitAdminRecords() {
  const tbody = document.getElementById("adminRecordsBody");
  if (!tbody) return;

  const footer = document.querySelector(".table-footer");

  /* Which rows have their password currently revealed */
  const revealed = new Set();

  /* Look up the user record linked to a student ID */
  function userFor(studentId) {
    return EW_DB.users.all().find((x) => x.studentId === studentId) || null;
  }

  function render() {
    const rows = EW_DB.students.all();

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem;">
        No registered students yet.</td></tr>`;
      if (footer) {
        const el = footer.querySelector(".table-footer-count") || footer;
        el.textContent = `Showing 0 of 0 students`;
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = rows
      .map((s) => {
        const u = userFor(s.id);
        const email = u ? u.email : "—";
        const password = u ? u.password : null;
        const isRevealed = revealed.has(s.id);

        const passwordCell = !password
          ? `<span class="text-muted">—</span>`
          : `
          <div class="pwd-cell">
            <span class="pwd-value ${isRevealed ? "is-revealed" : ""}">
              ${isRevealed ? ewEsc(password) : "••••••••"}
            </span>
            <button type="button" class="pwd-btn" data-action="toggle-pwd"
                    data-student-id="${s.id}"
                    title="${isRevealed ? "Hide" : "Show"} password">
              <i data-lucide="${isRevealed ? "eye-off" : "eye"}"></i>
            </button>
            <button type="button" class="pwd-btn" data-action="copy-pwd"
                    data-student-id="${s.id}" title="Copy password">
              <i data-lucide="copy"></i>
            </button>
          </div>`;

        return `
        <tr class="clickable-row" data-student-id="${s.id}">
          <td>
            <div class="student-cell">
              <div class="avatar-initials">${ewEsc(s.initials)}</div>
              <div>
                <div class="student-name">${ewEsc(s.name)}</div>
              </div>
            </div>
          </td>
          <td class="text-muted" style="font-family: ui-monospace, 'SF Mono', monospace; font-size:.78rem;">
            ${ewEsc(s.id)}
          </td>
          <td>
            <div>${ewEsc(s.course || "—")}</div>
            <div class="text-muted" style="font-size:.72rem;">${ewEsc(s.section || "—")}</div>
          </td>
          <td class="text-muted" style="font-size:.78rem;">
            ${
              email !== "—"
                ? `<a href="mailto:${ewEsc(email)}" style="color:inherit;text-decoration:none;">${ewEsc(email)}</a>`
                : "—"
            }
          </td>
          <td>${passwordCell}</td>
          <td style="text-align:right;">
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="edit"
                      data-student-id="${s.id}" title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="icon-btn icon-danger" data-action="delete"
                      data-student-id="${s.id}" title="Delete">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    if (footer) {
      const el = footer.querySelector(".table-footer-count") || footer;
      el.textContent = `Showing ${rows.length} of ${rows.length} students`;
    }
    if (window.lucide) lucide.createIcons();
  }

  /* ---- Clicks ---- */
  tbody.addEventListener("click", async (e) => {
    if (e.target.closest('a[href^="mailto:"]')) {
      e.stopPropagation();
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();

      const id = btn.dataset.studentId;

      /* Toggle password visibility */
      if (btn.dataset.action === "toggle-pwd") {
        if (revealed.has(id)) revealed.delete(id);
        else revealed.add(id);
        render();
        return;
      }

      /* Copy password */
      if (btn.dataset.action === "copy-pwd") {
        const u = userFor(id);
        if (!u || !u.password) return;
        try {
          await navigator.clipboard.writeText(u.password);
          btn.classList.add("is-copied");
          setTimeout(() => btn.classList.remove("is-copied"), 1200);
        } catch (_) {
          const ta = document.createElement("textarea");
          ta.value = u.password;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          btn.classList.add("is-copied");
          setTimeout(() => btn.classList.remove("is-copied"), 1200);
        }
        return;
      }

      /* Edit */
      if (btn.dataset.action === "edit") {
        const student = EW_DB.students.get(id);
        if (student) {
          await ewAdminStudentFormModal(student);
          render();
        }
        return;
      }

      /* Delete */
      if (btn.dataset.action === "delete") {
        const student = EW_DB.students.get(id);
        if (!student) return;
        const ok = await ewConfirm({
          title: `Delete ${student.name}?`,
          body: `This will remove the student record and unlink their login account. This cannot be undone.`,
          confirmLabel: "Delete",
          danger: true,
        });
        if (ok) {
          revealed.delete(id);
          await EW_DB.deleteStudent(id);
          render();
        }
        return;
      }
    }

    /* Row click → detail */
    const row = e.target.closest("tr[data-student-id]");
    if (row)
      window.location.href = `admin-student.html?id=${row.dataset.studentId}`;
  });

  /* ----- Initial skeleton, then real render ----- */
  tbody.innerHTML = Array.from({ length: 5 })
    .map(() => ewSkeletonTableRow(6))
    .join("");

  if (window.lucide) lucide.createIcons();

  (async function () {
    await ewMinDelay(220); // brief shimmer for the demo
    EW_DB.subscribe(render);
    render();
  })();
}

/* ============================================================
   Skeleton helpers
   ============================================================ */
function ewSkeletonMetricCard() {
  return `
    <div class="sk-metric-card">
      <div class="skeleton sk-metric-value"></div>
      <div class="skeleton sk-metric-label"></div>
      <div class="skeleton sk-metric-sub"></div>
    </div>`;
}

function ewSkeletonPanel(lines = 4) {
  const rows = Array.from({ length: lines })
    .map(
      (_, i) =>
        `<div class="skeleton sk-line" style="width:${100 - i * 8}%"></div>`,
    )
    .join("");
  return `
    <div class="sk-panel">
      <div class="skeleton sk-panel-title"></div>
      ${rows}
    </div>`;
}

function ewSkeletonTableRow(cols) {
  return `
    <tr class="skeleton-row">
      <td colspan="${cols}" style="padding:0;">
        <div class="sk-table-row" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
          <div class="cell-avatar-name">
            <div class="skeleton avatar"></div>
            <div class="name-lines">
              <div class="skeleton l1"></div>
              <div class="skeleton l2"></div>
            </div>
          </div>
          ${Array.from({ length: cols - 1 })
            .map(() => `<div class="skeleton sk-line sk-w-70"></div>`)
            .join("")}
        </div>
      </td>
    </tr>`;
}

function ewSkeletonDetailHeader() {
  return `
    <div class="sk-detail-header">
      <div class="left">
        <div class="skeleton avatar"></div>
        <div class="lines">
          <div class="skeleton l1"></div>
          <div class="skeleton l2"></div>
          <div class="skeleton l3"></div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="skeleton v"></div><div class="skeleton l"></div></div>
        <div class="stat"><div class="skeleton v"></div><div class="skeleton l"></div></div>
        <div class="stat"><div class="skeleton v"></div><div class="skeleton l"></div></div>
      </div>
    </div>`;
}

function ewSkeletonTabs() {
  return `
    <div class="sk-tabs">
      <div class="skeleton tab"></div>
      <div class="skeleton tab"></div>
      <div class="skeleton tab"></div>
      <div class="skeleton tab"></div>
    </div>`;
}

function ewSkeletonListCard() {
  return `
    <div class="sk-list-card">
      <div class="skeleton icon"></div>
      <div class="content">
        <div class="skeleton l1"></div>
        <div class="skeleton l2"></div>
      </div>
      <div class="skeleton btn"></div>
    </div>`;
}

/* Delay helper so skeletons are visible for at least `ms` */
function ewMinDelay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---- Skeleton ---- */
function renderSkeleton(rowCount = 5) {
  if (window.EW_SKEL) {
    window.EW_SKEL.tableRows(tbody, rowCount, {
      cols: [
        { type: "student" },
        { w: 120 },
        { type: "stack", w1: 180, w2: 80 },
        { w: 180 },
        { w: 120 },
        { type: "actions" },
      ],
    });
  }
}

render();
tbody.classList.add("skel-reveal");

renderDashboardSkeleton();
Promise.all([
  EW_DB && EW_DB.ready ? EW_DB.ready : Promise.resolve(),
  new Promise((r) => setTimeout(r, 350)),
]).then(() => {
  render();
  document.querySelector(".metrics-grid")?.classList.add("skel-reveal");
  document.getElementById("courseGrid")?.classList.add("skel-reveal");
  document.getElementById("activityFeed")?.classList.add("skel-reveal");
  document.getElementById("topRiskTable")?.classList.add("skel-reveal");
  EW_DB.subscribe(render);
});

  function renderAlertsSkeleton() {
    if (window.EW_SKEL) window.EW_SKEL.alertCards(list, 5);
  }

    EW_DB.subscribe(render);
  render();

    renderAlertsSkeleton();
  Promise.all([
    (EW_DB && EW_DB.ready) ? EW_DB.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 350))
  ]).then(() => {
    render();
    list.classList.add("skel-reveal");
    EW_DB.subscribe(render);
  });