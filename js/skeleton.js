/* ============================================================
   EarlyWatch — Shared Skeleton Renderers
   Depends on: nothing
   ============================================================ */

window.EW_SKEL = (function () {
  "use strict";

  function line(width, height = 12) {
    return `<div class="skel skel-line" style="width:${width}px;height:${height}px"></div>`;
  }

  function block(widthPct, height) {
    return `<div class="skel skel-line" style="width:${widthPct}%;height:${height}px"></div>`;
  }

  /* ---- Table body skeleton ---- */
  function tableRows(tbody, count = 5, options = {}) {
    const cols = options.cols || [];
    const rows = Array.from({ length: count }, () => {
      const cells = cols.map(c => {
        if (c.type === "student") {
          return `
            <td>
              <div class="student-cell">
                <div class="skel skel-avatar"></div>
                <div>
                  ${line(120, 13)}
                  <div style="height:6px"></div>
                  ${line(70, 11)}
                </div>
              </div>
            </td>`;
        }
        if (c.type === "stack") {
          return `
            <td>
              ${line(c.w1 || 180, 13)}
              <div style="height:6px"></div>
              ${line(c.w2 || 80, 11)}
            </td>`;
        }
        if (c.type === "actions") {
          return `
            <td style="text-align:right;">
              <div class="row-actions">
                <div class="skel skel-btn"></div>
                <div class="skel skel-btn"></div>
              </div>
            </td>`;
        }
        return `<td>${line(c.w || 120, 12)}</td>`;
      }).join("");

      return `<tr class="skeleton-row">${cells}</tr>`;
    }).join("");

    tbody.innerHTML = rows;
  }

  /* ---- Metric cards skeleton (dashboard top row) ---- */
  function metricCards(grid, count = 4) {
    const card = `
      <div class="metric-card">
        ${line(60, 26)}
        <div style="height:8px"></div>
        ${line(120, 12)}
        <div style="height:6px"></div>
        ${line(150, 10)}
      </div>`;
    if (grid) grid.innerHTML = Array.from({ length: count }, () => card).join("");
  }

  /* ---- Widget cards (progress / status lists) ---- */
  function widgetCard(el, rows = 4) {
    const row = `
      <div style="margin-bottom:.9rem;">
        ${line(110, 11)}
        <div style="height:8px"></div>
        <div class="skel skel-line" style="width:100%;height:7px;border-radius:999px;"></div>
      </div>`;
    if (el) el.innerHTML = Array.from({ length: rows }, () => row).join("");
  }

  /* ---- Course/program card grid ---- */
  function cardGrid(container, count = 3) {
    const card = `
      <div class="course-card">
        ${line(160, 14)}
        <div style="height:10px"></div>
        ${line(80, 11)}
        <div style="height:14px"></div>
        <div class="course-stats">
          <div class="skel skel-line" style="height:44px;"></div>
          <div class="skel skel-line" style="height:44px;"></div>
          <div class="skel skel-line" style="height:44px;"></div>
          <div class="skel skel-line" style="height:44px;"></div>
        </div>
      </div>`;
    if (container) container.innerHTML = Array.from({ length: count }, () => card).join("");
  }

  /* ---- Activity feed ---- */
  function activityFeed(el, count = 5) {
    const row = `
      <div class="activity-item">
        <div class="skel skel-avatar" style="border-radius:8px;"></div>
        <div style="flex:1;">
          ${line(220, 12)}
          <div style="height:6px"></div>
          ${line(90, 10)}
        </div>
      </div>`;
    if (el) el.innerHTML = Array.from({ length: count }, () => row).join("");
  }

  /* ---- Alert card list ---- */
  function alertCards(el, count = 4) {
    const card = `
      <div class="alert-card" style="opacity:.7;">
        <div class="skel skel-avatar" style="border-radius:6px;"></div>
        <div style="flex:1;">
          ${line(180, 12)}
          <div style="height:6px"></div>
          ${line(320, 11)}
        </div>
      </div>`;
    if (el) el.innerHTML = Array.from({ length: count }, () => card).join("");
  }

  /* ---- Intervention card list ---- */
  function interventionCards(el, count = 3) {
    const card = `
      <div class="intervention-card" style="opacity:.7;">
        <div class="card-header">
          ${line(150, 13)}
          ${line(70, 12)}
        </div>
        <div style="height:6px"></div>
        ${line(340, 12)}
        <div style="height:10px"></div>
        ${line(120, 10)}
      </div>`;
    if (el) el.innerHTML = Array.from({ length: count }, () => card).join("");
  }

  /* ---- Student subject cards ---- */
  function subjectCards(el, count = 3) {
    const card = `
      <div class="subject-card" style="opacity:.7;">
        <div class="subject-top">
          <div class="subject-left">
            ${line(60, 12)}
            <div style="height:8px"></div>
            ${line(220, 14)}
            <div style="height:6px"></div>
            ${line(140, 11)}
          </div>
          <div class="skel skel-line" style="width:50px;height:28px;"></div>
        </div>
        <div class="subject-stats">
          <div class="skel skel-line" style="height:52px;"></div>
          <div class="skel skel-line" style="height:52px;"></div>
          <div class="skel skel-line" style="height:52px;"></div>
        </div>
      </div>`;
    if (el) el.innerHTML = Array.from({ length: count }, () => card).join("");
  }

  /* ---- Risk banner skeleton (student dashboard) ---- */
  function riskBanner(el) {
    if (!el) return;
    el.innerHTML = `
      <div class="skel skel-avatar" style="border-radius:6px;"></div>
      <div style="flex:1;">
        ${line(280, 14)}
        <div style="height:8px"></div>
        ${line(420, 12)}
      </div>`;
  }

  /* ---- Student-detail page skeleton ---- */
  function detailPage(root) {
    if (!root) return;
    root.innerHTML = `
      <div class="skel skel-line" style="width:150px;height:14px;margin-bottom:1.25rem;"></div>

      <div class="detail-header" style="margin-bottom:1rem;">
        <div class="detail-header-left">
          <div class="skel skel-avatar" style="width:68px;height:68px;border-radius:14px;"></div>
          <div style="flex:1;">
            ${line(220, 20)}
            <div style="height:10px"></div>
            ${line(320, 12)}
            <div style="height:8px"></div>
            ${line(260, 12)}
          </div>
        </div>
        <div class="detail-header-stats">
          <div style="text-align:center;">
            ${line(60, 20)}
            <div style="height:6px"></div>
            ${line(50, 10)}
          </div>
          <div style="text-align:center;">
            ${line(60, 20)}
            <div style="height:6px"></div>
            ${line(70, 10)}
          </div>
          <div style="text-align:center;">
            ${line(60, 20)}
            <div style="height:6px"></div>
            ${line(50, 10)}
          </div>
        </div>
      </div>

      <div class="detail-tabs" style="margin-bottom:1.25rem;">
        ${line(80, 16)}
        ${line(80, 16)}
        ${line(110, 16)}
        ${line(70, 16)}
      </div>

      <div class="detail-two-col">
        <div class="panel">
          ${line(140, 12)}
          <div style="height:14px"></div>
          ${line(200, 13)}<div style="height:6px"></div>
          <div class="skel skel-line" style="width:100%;height:6px;border-radius:999px;"></div>
          <div style="height:14px"></div>
          ${line(180, 13)}<div style="height:6px"></div>
          <div class="skel skel-line" style="width:100%;height:6px;border-radius:999px;"></div>
          <div style="height:14px"></div>
          ${line(160, 13)}<div style="height:6px"></div>
          <div class="skel skel-line" style="width:100%;height:6px;border-radius:999px;"></div>
        </div>
        <div class="panel">
          ${line(180, 12)}
          <div style="height:14px"></div>
          ${line(260, 12)}<div style="height:8px"></div>
          ${line(240, 12)}<div style="height:8px"></div>
          ${line(280, 12)}<div style="height:8px"></div>
          ${line(220, 12)}
        </div>
      </div>

      <div class="panel" style="margin-top:1rem;">
        ${line(220, 12)}
        <div style="height:14px"></div>
        ${line(80, 13)}<div style="height:6px"></div>
        <div class="skel skel-line" style="width:100%;height:22px;border-radius:4px;"></div>
        <div style="height:12px"></div>
        ${line(80, 13)}<div style="height:6px"></div>
        <div class="skel skel-line" style="width:100%;height:22px;border-radius:4px;"></div>
        <div style="height:12px"></div>
        ${line(80, 13)}<div style="height:6px"></div>
        <div class="skel skel-line" style="width:100%;height:22px;border-radius:4px;"></div>
      </div>
    `;
  }

  return {
    line, block,
    tableRows,
    metricCards,
    widgetCard,
    cardGrid,
    activityFeed,
    alertCards,
    interventionCards,
    subjectCards,
    riskBanner,
    detailPage
  };
})();