/* ============================================================
   EarlyWatch — Risk Engine
   student → risk score + level + breakdown
   ============================================================ */

const EW_RISK = (function () {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const WEIGHTS = { attendance: 0.35, gpa: 0.30, failed: 0.20, missing: 0.15 };
  const LABELS  = { attendance: "Attendance", gpa: "GPA", failed: "Failed subjects", missing: "Missing activities" };

  const FACTORS = {
    attendance: v => clamp((100 - v) / 40, 0, 1) * 100,
    gpa:        v => clamp((3.0 - v) / 2.0, 0, 1) * 100,
    failed:     v => clamp(v / 3, 0, 1) * 100,
    missing:    v => clamp(v / 12, 0, 1) * 100
  };

  const OVERRIDES = [
    { test: s => s.attendance < 60,     floor: 80, reason: "Attendance below 60%" },
    { test: s => s.failedSubjects >= 2, floor: 80, reason: "2+ failed subjects" },
    { test: s => s.gpa < 1.75,          floor: 75, reason: "GPA below 1.75" }
  ];

  const THRESHOLDS = { critical: 80, high: 50, medium: 30 };
  const LABEL_MAP  = { critical:"Critical", high:"High", medium:"Medium", low:"Low" };

  function levelFor(score) {
    if (score >= THRESHOLDS.critical) return "critical";
    if (score >= THRESHOLDS.high)     return "high";
    if (score >= THRESHOLDS.medium)   return "medium";
    return "low";
  }

  function compute(student) {
    const raw = {
      attendance: FACTORS.attendance(student.attendance),
      gpa:        FACTORS.gpa(student.gpa),
      failed:     FACTORS.failed(student.failedSubjects || 0),
      missing:    FACTORS.missing(student.missed || 0)
    };

    let score = Object.keys(WEIGHTS).reduce((sum, k) => sum + raw[k] * WEIGHTS[k], 0);

    const applied = [];
    for (const o of OVERRIDES) {
      if (o.test(student) && score < o.floor) {
        score = o.floor;
        applied.push(o.reason);
      }
    }

    score = Math.round(clamp(score, 0, 100));
    const level = levelFor(score);

    return {
      score,
      level,
      label: LABEL_MAP[level],
      overrides: applied,
      breakdown: Object.keys(WEIGHTS).map(k => ({
        key: k,
        label: LABELS[k],
        weighted: Math.round(raw[k] * WEIGHTS[k]),
        raw: Math.round(raw[k])
      })).sort((a, b) => b.weighted - a.weighted)
    };
  }

  function forStudent(id) {
    const s = EW_DB.students.get(id);
    return s ? compute(s) : null;
  }

  return { compute, forStudent, levelFor, WEIGHTS, THRESHOLDS, LABEL_MAP };
})();