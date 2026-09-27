/* ============================================================
   EarlyWatch — Student Profile page (adviser + instructor)
   ============================================================ */

(function () {
  const root = document.getElementById("profileRoot");
  const id   = new URLSearchParams(location.search).get("id");
  const user = ewCurrentUser();
  const isAdviser = user && user.role === "adviser";

  /* Where the "Back" link and post-delete redirect should go */
  const RECORDS_URL = isAdviser
    ? "student-records.html"
    : "instructor-student-records.html";

  function render() {
    const s = id ? EW_DB.students.get(id) : null;

    if (!s) {
      root.innerHTML = `<div class="empty-state">
        <h2>Student not found</h2>
        <p class="text-muted">No student matches <code>${ewEsc(id || "(no id)")}</code>.</p>
        <a class="btn-back" href="${RECORDS_URL}">← Back to Student Records</a>
      </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const risk   = EW_RISK.compute(s);
    const alerts = EW_DB.alerts.for(s.id);
    const ivs    = EW_DB.interventions.for(s.id);

    const navBadge = document.getElementById("navAlertCount");
    if (navBadge) navBadge.textContent = EW_DB.alerts.unread().length;

    const reasons = risk.breakdown.map(b => `
      <div class="why-row">
        <div class="why-head">
          <span>${b.label}</span>
          <span class="text-muted">${b.weighted} pts</span>
        </div>
        <div class="progress-bar">
          <div class="fill ${risk.level}" style="width:${b.raw}%"></div>
        </div>
      </div>`).join("");

    const overrideNote = risk.overrides.length
      ? `<div class="override-note">
           <i data-lucide="alert-triangle"></i>
           <span>Escalated by rule: ${risk.overrides.join(", ")}</span>
         </div>` : "";

    const subjectRows = s.subjects.length ? s.subjects.map(sub => {
      const fail = sub.grade < 75;
      return `
        <tr>
          <td><span class="subject-code">${sub.code}</span></td>
          <td>
            <div class="student-name">${ewEsc(sub.name)}</div>
            <div class="text-muted">${ewEsc(sub.instructor || "—")}</div>
          </td>
          <td>${sub.prelim ?? "—"}</td>
          <td>${sub.midterm ?? "—"}</td>
          <td class="${fail ? "text-danger" : "text-success"} font-bold">${sub.grade ?? "—"}</td>
          <td>${ewAttendanceBar(sub.attendance ?? 0)}</td>
          <td>${fail
                ? '<span class="tag tag-critical">Failing</span>'
                : '<span class="tag tag-low">Passing</span>'}</td>
        </tr>`;
    }).join("")
      : `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:1.5rem;">
           No subject data recorded for this student yet.</td></tr>`;

    const maxRisk = 100;
    const historyBars = (s.history && s.history.length) ? s.history.map(h => `
      <div class="trend-col">
        <div class="trend-bar-wrap">
          <div class="trend-bar ${EW_RISK.levelFor(h.risk)}" style="height:${(h.risk / maxRisk) * 100}%"></div>
        </div>
        <div class="trend-label">${h.term}</div>
        <div class="trend-val">${h.risk}</div>
      </div>`).join("")
      : `<p class="text-muted">No trend data yet.</p>`;

    const alertItems = alerts.length ? alerts.map(a => `
      <div class="alert-card alert-${a.severity}">
        <div class="alert-icon-wrapper"><i data-lucide="bell" class="alert-icon"></i></div>
        <div class="alert-content">
          <div class="alert-header">
            <span class="alert-tag">${a.severity[0].toUpperCase() + a.severity.slice(1)} · ${ewEsc(a.kind)}</span>
            <span class="alert-date">${a.date}</span>
          </div>
          <p class="alert-message">${ewEsc(a.message)}</p>
        </div>
      </div>`).join("")
      : `<p class="text-muted">No alerts for this student.</p>`;

    const ivItems = ivs.length ? ivs.map(i => `
      <div class="intervention-card">
        <div class="card-header">
          <div class="student-info"><span class="type-badge">${ewEsc(i.type)}</span></div>
          <span class="status-badge status-${i.status}">
            ${i.status === "effective" ? "Effective" : "Pending"}
          </span>
        </div>
        <p class="intervention-desc">${ewEsc(i.action)}</p>
        <div class="card-footer">
          ${i.date} · By: ${ewEsc(i.assigned || "—")}
          ${i.deadline ? ` · Follow-up: <strong>${i.deadline}</strong>` : ""}
        </div>
      </div>`).join("")
      : `<p class="text-muted">No interventions logged yet.</p>`;

    const noteItems = s.notes.length ? s.notes.map(n => `
      <div class="note-item">
        <div class="note-meta">${n.date} · ${ewEsc(n.author)}</div>
        <p>${ewEsc(n.text)}</p>
      </div>`).join("")
      : `<p class="text-muted">No adviser notes yet.</p>`;

    /* Only advisers can edit / delete student records */
    const actionsHTML = isAdviser
      ? `<div class="profile-actions">
          <button type="button" class="ew-btn ew-btn-ghost" data-action="edit-profile">
            <i data-lucide="pencil"></i> Edit
          </button>
          <button type="button" class="ew-btn ew-btn-danger" data-action="delete-profile">
            <i data-lucide="trash-2"></i> Delete
          </button>
        </div>`
      : "";

    root.innerHTML = `
      <header class="header profile-header">
        <a class="btn-back" href="${RECORDS_URL}">
          <i data-lucide="arrow-left"></i> Back
        </a>
        <div class="profile-identity">
          <div class="avatar-initials bg-${risk.level} avatar-lg">${s.initials}</div>
          <div>
            <h1>${ewEsc(s.name)}</h1>
            <p class="subtitle">${s.id} · ${ewEsc(s.course || "—")} · ${ewEsc(s.section || "—")} · Adviser: ${ewEsc(s.adviser || "—")}</p>
          </div>
        </div>

        ${actionsHTML}

        <div class="risk-hero risk-hero-${risk.level}">
          <div class="risk-hero-score">${risk.score}</div>
          <div class="risk-hero-label">${risk.label} Risk</div>
        </div>
      </header>

      <section class="metrics-grid profile-metrics">
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
          <h3>Why is this student at risk?</h3>
          <div class="why-list">${reasons}</div>
          ${overrideNote}
        </section>

        <section class="panel">
          <h3>Risk Trend</h3>
          <div class="trend-chart">${historyBars}</div>
        </section>

        <section class="panel panel-full">
          <h3>Subject Breakdown</h3>
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
          <h3>Alerts (${alerts.length})</h3>
          <div class="alerts-list">${alertItems}</div>
        </section>

        <section class="panel">
          <h3>Interventions (${ivs.length})</h3>
          <div class="interventions-list">${ivItems}</div>
        </section>

        <section class="panel panel-full">
          <h3>Adviser Notes</h3>
          <div class="notes-list">${noteItems}</div>
        </section>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    ewPaintUser();
  }

  root.addEventListener("click", async e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    /* Only advisers may edit / delete */
    if (!isAdviser) return;

    const s = EW_DB.students.get(id);
    if (!s) return;

    if (btn.dataset.action === "edit-profile") {
      await ewStudentFormModal(s);
      render();
    }

    if (btn.dataset.action === "delete-profile") {
      const alertCount = EW_DB.alerts.for(id).length;
      const ivCount    = EW_DB.interventions.for(id).length;
      const extra = (alertCount || ivCount)
        ? ` This will also remove ${alertCount} alert(s) and ${ivCount} intervention(s).`
        : "";
      const ok = await ewConfirm({
        title: `Delete ${s.name}?`,
        body:  `This cannot be undone.${extra}`,
        confirmLabel: "Delete",
        danger: true
      });
      if (ok) {
        EW_DB.deleteStudent(id);
        window.location.href = RECORDS_URL;
      }
    }
  });

  // Wait for initial data load, then render and subscribe
  EW_DB.ready.then(() => {
    render();
    EW_DB.subscribe(render);
  });
})();