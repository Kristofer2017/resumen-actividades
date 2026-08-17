(() => {
  const $ = (id) => document.getElementById(id);
  const SAVE_DELAY_MS = 250;

  const state = {
    year: window.__INITIAL__.year,
    week: window.__INITIAL__.week,
    days: [],
    dayText: {},
    saveTimers: {},
    pendingSaves: {},
  };

  const els = {
    year: $("year"),
    week: $("week"),
    weekRange: $("week-range"),
    days: $("days"),
    filledCount: $("filled-count"),
    nombre: $("nombre"),
    cargo: $("cargo"),
    unidad: $("unidad"),
    cumplimiento: $("cumplimiento"),
    proyecciones: $("proyecciones"),
    observaciones: $("observaciones"),
    previewDialog: $("preview-dialog"),
    previewFrame: $("preview-frame"),
  };

  function currentWeekDates() {
    return state.days.map((d) => d.date);
  }

  function countFilledDays() {
    return currentWeekDates().filter((date) => {
      const text = state.dayText[date];
      return text && text.trim();
    }).length;
  }

  function updateFilledChip() {
    const n = countFilledDays();
    els.filledCount.textContent =
      n === 1 ? "1 día con actividades" : `${n} días con actividades`;
  }

  async function saveDay(date, text) {
    delete state.pendingSaves[date];
    const res = await fetch("/api/days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, text }),
    });
    if (!res.ok) throw new Error("No se pudo guardar el día");
  }

  function queueSave(date, text) {
    state.dayText[date] = text;
    state.pendingSaves[date] = text;
    if (state.saveTimers[date]) clearTimeout(state.saveTimers[date]);
    state.saveTimers[date] = setTimeout(() => {
      saveDay(date, text).catch((e) => alert(e.message));
    }, SAVE_DELAY_MS);
  }

  async function flushPendingSaves() {
    const pending = { ...state.pendingSaves };
    Object.keys(state.saveTimers).forEach((date) => {
      clearTimeout(state.saveTimers[date]);
      delete state.saveTimers[date];
    });
    els.days.querySelectorAll("textarea[data-date]").forEach((ta) => {
      pending[ta.dataset.date] = ta.value;
      state.dayText[ta.dataset.date] = ta.value;
    });
    await Promise.all(
      Object.entries(pending).map(([date, text]) => saveDay(date, text))
    );
  }

  function buildPayload() {
    return {
      nombre: els.nombre.value.trim(),
      cargo: els.cargo.value.trim(),
      unidad: els.unidad.value.trim(),
      year: Number(els.year.value),
      week: Number(els.week.value),
      cumplimiento: els.cumplimiento.value,
      proyecciones: els.proyecciones.value,
      observaciones: els.observaciones.value,
    };
  }

  function renderDays() {
    els.days.innerHTML = "";
    state.days.forEach((day) => {
      const wrap = document.createElement("div");
      const isWeekend = day.weekday >= 5;
      const text = state.dayText[day.date] || "";
      const has = Boolean(text.trim());
      wrap.className =
        "day-card" + (isWeekend ? " weekend" : "") + (has ? " has-content" : "");

      wrap.innerHTML = `
        <div class="day-head">
          <strong>${day.dayName} ${day.dayNumber}</strong>
          <span class="meta">${day.label}</span>
        </div>
        <textarea data-date="${day.date}" rows="4" placeholder="Una actividad por línea…">${escapeHtml(
          text
        )}</textarea>
      `;

      const ta = wrap.querySelector("textarea");
      ta.addEventListener("input", () => {
        wrap.classList.toggle("has-content", Boolean(ta.value.trim()));
        updateFilledChip();
        queueSave(day.date, ta.value);
      });
      ta.addEventListener("change", () => {
        queueSave(day.date, ta.value);
      });

      els.days.appendChild(wrap);
    });
    updateFilledChip();
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function loadWeek(year, week) {
    await flushPendingSaves().catch(() => {});
    const res = await fetch(`/api/week?year=${year}&week=${week}`);
    if (!res.ok) throw new Error("No se pudo cargar la semana");
    const data = await res.json();
    state.year = data.year;
    state.week = data.week;
    state.days = data.days;
    state.dayText = {};
    data.days.forEach((day) => {
      state.dayText[day.date] = day.text || "";
    });
    els.year.value = data.year;
    els.week.value = data.week;
    els.weekRange.textContent = `Semana ${data.week} · ${data.rangeLabel}`;
    renderDays();
  }

  function shiftWeek(delta) {
    let y = Number(els.year.value);
    let w = Number(els.week.value) + delta;
    if (w < 1) {
      y -= 1;
      w = 52;
    } else if (w > 53) {
      y += 1;
      w = 1;
    }
    loadWeek(y, w).catch(alert);
  }

  async function postPdf(endpoint, { download } = {}) {
    await flushPendingSaves();
    const payload = buildPayload();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Error al generar el PDF");
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const filename = match
      ? decodeURIComponent(match[1].replace(/"/g, ""))
      : "informe-actividades.pdf";

    if (download) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
      const url = URL.createObjectURL(blob);
      if (els.previewFrame.dataset.url) {
        URL.revokeObjectURL(els.previewFrame.dataset.url);
      }
      els.previewFrame.dataset.url = url;
      els.previewFrame.src = url;
      els.previewDialog.showModal();
    }
  }

  $("btn-prev-week").addEventListener("click", () => shiftWeek(-1));
  $("btn-next-week").addEventListener("click", () => shiftWeek(1));
  els.year.addEventListener("change", () =>
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert)
  );
  els.week.addEventListener("change", () =>
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert)
  );

  $("btn-clear-days").addEventListener("click", async () => {
    if (!confirm("¿Borrar las actividades de esta semana?")) return;
    Object.keys(state.saveTimers).forEach((date) => {
      clearTimeout(state.saveTimers[date]);
      delete state.saveTimers[date];
    });
    state.pendingSaves = {};
    const res = await fetch("/api/week/clear-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(els.year.value),
        week: Number(els.week.value),
      }),
    });
    if (!res.ok) {
      alert("No se pudieron borrar los días");
      return;
    }
    currentWeekDates().forEach((date) => {
      state.dayText[date] = "";
    });
    renderDays();
  });

  $("btn-download").addEventListener("click", () => {
    postPdf("/api/pdf", { download: true }).catch((e) => alert(e.message));
  });

  $("btn-preview").addEventListener("click", () => {
    postPdf("/api/preview", { download: false }).catch((e) => alert(e.message));
  });

  $("btn-close-preview").addEventListener("click", () => {
    els.previewDialog.close();
  });

  loadWeek(state.year, state.week).catch((e) => {
    els.weekRange.textContent = "Error cargando la semana";
    console.error(e);
  });
})();
