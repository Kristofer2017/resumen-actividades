(() => {
  const $ = (id) => document.getElementById(id);
  const SAVE_DELAY_MS = 250;
  const PREVIEW_DELAY_MS = 450;

  const state = {
    year: window.__INITIAL__.year,
    week: window.__INITIAL__.week,
    days: [],
    dayText: {},
    saveTimers: {},
    pendingSaves: {},
    mode: "day",
    selectedDate: null,
    previewTimer: null,
    previewAbort: null,
    previewFront: "a",
    previewUrls: { a: null, b: null },
    previewFingerprint: "",
  };

  const els = {
    year: $("year"),
    week: $("week"),
    weekRange: $("week-range"),
    days: $("days"),
    filledCount: $("filled-count"),
    filledCountWeek: $("filled-count-week"),
    nombre: $("nombre"),
    cargo: $("cargo"),
    unidad: $("unidad"),
    cumplimiento: $("cumplimiento"),
    proyecciones: $("proyecciones"),
    observaciones: $("observaciones"),
    previewA: $("preview-a"),
    previewB: $("preview-b"),
    previewStatus: $("preview-status"),
    dayTabs: $("day-tabs"),
    dayEditor: $("day-editor"),
    dayTitle: $("day-title"),
    btnModeDay: $("btn-mode-day"),
    btnModeWeek: $("btn-mode-week"),
  };

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function currentWeekDates() {
    return state.days.map((d) => d.date);
  }

  function selectedDay() {
    return state.days.find((d) => d.date === state.selectedDate) || state.days[0];
  }

  function countFilledDays() {
    return currentWeekDates().filter((date) => {
      const text = state.dayText[date];
      return text && text.trim();
    }).length;
  }

  function filledLabel(n) {
    return n === 1 ? "1 día con actividades" : `${n} días con actividades`;
  }

  function updateFilledChip() {
    const label = filledLabel(countFilledDays());
    els.filledCount.textContent = label;
    els.filledCountWeek.textContent = label;
  }

  function setPreviewStatus(text) {
    if (!els.previewStatus) return;
    els.previewStatus.textContent = text || "";
    els.previewStatus.hidden = !text;
  }

  function previewFingerprint() {
    return JSON.stringify({
      ...buildPayload(),
      days: state.dayText,
    });
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

  function collectVisibleText() {
    if (els.dayEditor && state.selectedDate) {
      state.dayText[state.selectedDate] = els.dayEditor.value;
      state.pendingSaves[state.selectedDate] = els.dayEditor.value;
    }
    els.days.querySelectorAll("textarea[data-date]").forEach((ta) => {
      state.dayText[ta.dataset.date] = ta.value;
      state.pendingSaves[ta.dataset.date] = ta.value;
    });
  }

  function queueSave(date, text) {
    state.dayText[date] = text;
    state.pendingSaves[date] = text;
    if (state.saveTimers[date]) clearTimeout(state.saveTimers[date]);
    state.saveTimers[date] = setTimeout(() => {
      saveDay(date, text)
        .then(() => queuePreview())
        .catch((e) => alert(e.message));
    }, SAVE_DELAY_MS);
  }

  async function flushPendingSaves() {
    collectVisibleText();
    const pending = { ...state.pendingSaves };
    Object.keys(state.saveTimers).forEach((date) => {
      clearTimeout(state.saveTimers[date]);
      delete state.saveTimers[date];
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

  function queuePreview() {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(() => {
      refreshPreview().catch((err) => {
        if (err.name !== "AbortError") setPreviewStatus("Error al generar");
      });
    }, PREVIEW_DELAY_MS);
  }

  function showPreviewUrl(url) {
    const backKey = state.previewFront === "a" ? "b" : "a";
    const back = backKey === "a" ? els.previewA : els.previewB;
    const front = state.previewFront === "a" ? els.previewA : els.previewB;
    return new Promise((resolve, reject) => {
      const onLoad = () => {
        back.classList.add("is-shown");
        front.classList.remove("is-shown");
        const oldUrl = state.previewUrls[state.previewFront];
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        state.previewUrls[state.previewFront] = null;
        state.previewUrls[backKey] = url;
        state.previewFront = backKey;
        resolve();
      };
      const onError = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo mostrar la vista previa"));
      };
      back.addEventListener("load", onLoad, { once: true });
      back.addEventListener("error", onError, { once: true });
      back.src = url;
    });
  }

  async function refreshPreview() {
    await flushPendingSaves();
    const fingerprint = previewFingerprint();
    if (fingerprint === state.previewFingerprint) return;

    if (state.previewAbort) state.previewAbort.abort();
    state.previewAbort = new AbortController();
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
      signal: state.previewAbort.signal,
    });
    if (!res.ok) throw new Error("Error al generar el PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await showPreviewUrl(url);
    state.previewFingerprint = fingerprint;
    setPreviewStatus("");
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function pickDefaultDay() {
    const today = todayIso();
    if (state.days.some((d) => d.date === today)) return today;
    return state.days[0] ? state.days[0].date : null;
  }

  function setMode(mode) {
    collectVisibleText();
    state.mode = mode;
    document.body.classList.toggle("mode-day", mode === "day");
    document.body.classList.toggle("mode-week", mode === "week");
    els.btnModeDay.classList.toggle("is-active", mode === "day");
    els.btnModeWeek.classList.toggle("is-active", mode === "week");
    els.btnModeDay.setAttribute("aria-pressed", String(mode === "day"));
    els.btnModeWeek.setAttribute("aria-pressed", String(mode === "week"));
    if (mode === "week") renderWeekDays();
    else renderDayView();
  }

  function selectDay(date) {
    collectVisibleText();
    state.selectedDate = date;
    renderDayView();
  }

  function renderDayTabs() {
    els.dayTabs.innerHTML = "";
    state.days.forEach((day) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-tab";
      if (day.date === state.selectedDate) btn.classList.add("is-active");
      if ((state.dayText[day.date] || "").trim()) btn.classList.add("has-content");
      btn.innerHTML = `${day.dayName.slice(0, 3)}<small>${day.dayNumber}</small>`;
      btn.addEventListener("click", () => selectDay(day.date));
      els.dayTabs.appendChild(btn);
    });
  }

  function renderDayView() {
    const day = selectedDay();
    if (!day) {
      els.dayEditor.value = "";
      els.dayTitle.textContent = "Actividades del día";
      return;
    }
    state.selectedDate = day.date;
    els.dayTitle.textContent = day.label;
    els.dayEditor.value = state.dayText[day.date] || "";
    renderDayTabs();
    updateFilledChip();
  }

  function renderWeekDays() {
    els.days.innerHTML = "";
    state.days.forEach((day) => {
      const wrap = document.createElement("div");
      const text = state.dayText[day.date] || "";
      const has = Boolean(text.trim());
      wrap.className = "day-card" + (has ? " has-content" : "");
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
      ta.addEventListener("change", () => queueSave(day.date, ta.value));
      els.days.appendChild(wrap);
    });
    updateFilledChip();
  }

  function renderViews() {
    if (state.mode === "week") renderWeekDays();
    else renderDayView();
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
    state.selectedDate = pickDefaultDay();
    els.year.value = data.year;
    els.week.value = data.week;
    els.weekRange.textContent = `Semana ${data.week} · ${data.rangeLabel}`;
    renderViews();
    queuePreview();
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

  async function downloadPdf() {
    await flushPendingSaves();
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    if (!res.ok) throw new Error("Error al generar el PDF");
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const filename = match
      ? decodeURIComponent(match[1].replace(/"/g, ""))
      : "informe-actividades.pdf";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  els.dayEditor.addEventListener("input", () => {
    const day = selectedDay();
    if (!day) return;
    const text = els.dayEditor.value;
    state.dayText[day.date] = text;
    updateFilledChip();
    els.dayTabs.querySelectorAll(".day-tab").forEach((btn, i) => {
      const d = state.days[i];
      if (d) btn.classList.toggle("has-content", Boolean((state.dayText[d.date] || "").trim()));
    });
    queueSave(day.date, text);
  });
  els.dayEditor.addEventListener("change", () => {
    const day = selectedDay();
    if (day) queueSave(day.date, els.dayEditor.value);
  });

  els.btnModeDay.addEventListener("click", () => setMode("day"));
  els.btnModeWeek.addEventListener("click", () => setMode("week"));

  $("btn-prev-week").addEventListener("click", () => shiftWeek(-1));
  $("btn-next-week").addEventListener("click", () => shiftWeek(1));
  els.year.addEventListener("change", () =>
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert)
  );
  els.week.addEventListener("change", () =>
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert)
  );

  ["nombre", "cargo", "unidad", "cumplimiento", "proyecciones", "observaciones"].forEach(
    (id) => {
      $(id).addEventListener("input", queuePreview);
      $(id).addEventListener("change", queuePreview);
    }
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
    renderViews();
    queuePreview();
  });

  $("btn-download").addEventListener("click", () => {
    downloadPdf().catch((e) => alert(e.message));
  });

  setMode("day");
  loadWeek(state.year, state.week).catch((e) => {
    els.weekRange.textContent = "Error cargando la semana";
    console.error(e);
  });
})();
