(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    year: window.__INITIAL__.year,
    week: window.__INITIAL__.week,
    wantedDay: window.__INITIAL__.day || null,
    days: [],
    dayText: {},
    pendingSaves: {},
    savingDates: new Set(),
    pendingMeta: false,
    pendingSettings: false,
    ready: false,
    saveTimers: {},
    mode: "day",
    selectedDate: null,
    previewAbort: null,
    previewInFlight: false,
    previewQueued: false,
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
    resumen: $("resumen"),
    generalChip: $("general-chip"),
    btnModeDay: $("btn-mode-day"),
    btnModeWeek: $("btn-mode-week"),
    btnModeGeneral: $("btn-mode-general"),
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
    updateGeneralChip();
  }

  function updateGeneralChip() {
    if (!els.generalChip) return;
    const hasResumen = Boolean((els.resumen.value || "").trim());
    const days = countFilledDays();
    if (hasResumen && days > 0) {
      els.generalChip.textContent = "PDF prioriza resumen";
    } else if (hasResumen) {
      els.generalChip.textContent = "Resumen general";
    } else {
      els.generalChip.textContent = "Sin resumen";
    }
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
    const res = await fetch("/api/days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, text }),
    });
    if (!res.ok) throw new Error("No se pudo guardar el día");
  }

  function collectVisibleText() {
    if (els.dayEditor && state.selectedDate) {
      const text = els.dayEditor.value;
      state.dayText[state.selectedDate] = text;
      if (state.ready) state.pendingSaves[state.selectedDate] = text;
    }
    els.days.querySelectorAll("textarea[data-date]").forEach((ta) => {
      state.dayText[ta.dataset.date] = ta.value;
      if (state.ready) state.pendingSaves[ta.dataset.date] = ta.value;
    });
  }

  function syncDayText(date, text) {
    state.dayText[date] = text;
    if (!state.ready || !date) return;
    state.pendingSaves[date] = text;
    clearTimeout(state.saveTimers[date]);
    state.saveTimers[date] = setTimeout(() => {
      persistDay(date).catch((e) => alert(e.message));
    }, 250);
  }

  async function persistDay(date) {
    if (state.savingDates.has(date)) return;
    while (date in state.pendingSaves) {
      const text = state.pendingSaves[date];
      delete state.pendingSaves[date];
      state.savingDates.add(date);
      try {
        await saveDay(date, text);
      } finally {
        state.savingDates.delete(date);
      }
    }
  }

  async function saveWeekMeta() {
    const res = await fetch("/api/week/meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: state.year,
        week: state.week,
        cumplimiento: els.cumplimiento.value,
        proyecciones: els.proyecciones.value,
        observaciones: els.observaciones.value,
        resumen: els.resumen.value,
      }),
    });
    if (!res.ok) throw new Error("No se pudieron guardar las secciones de la semana");
  }

  async function saveSettings() {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: els.nombre.value.trim(),
        cargo: els.cargo.value.trim(),
        unidad: els.unidad.value.trim(),
      }),
    });
    if (!res.ok) throw new Error("No se pudieron guardar nombre y cargo");
  }

  function queueWeekMetaSave() {
    if (!state.ready) return;
    state.pendingMeta = true;
    clearTimeout(state.saveTimers.meta);
    state.saveTimers.meta = setTimeout(() => {
      persistWeekMeta().catch((e) => alert(e.message));
    }, 250);
  }

  function queueSettingsSave() {
    if (!state.ready) return;
    state.pendingSettings = true;
    clearTimeout(state.saveTimers.settings);
    state.saveTimers.settings = setTimeout(() => {
      persistSettings().catch((e) => alert(e.message));
    }, 250);
  }

  async function persistWeekMeta() {
    if (!state.pendingMeta) return;
    state.pendingMeta = false;
    await saveWeekMeta();
  }

  async function persistSettings() {
    if (!state.pendingSettings) return;
    state.pendingSettings = false;
    await saveSettings();
  }

  async function flushPendingSaves() {
    collectVisibleText();
    Object.values(state.saveTimers).forEach((timer) => clearTimeout(timer));
    state.saveTimers = {};
    await Promise.all(currentWeekDates().map((date) => persistDay(date)));
    await persistWeekMeta();
    await persistSettings();
  }

  function keepalivePut(url, body) {
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  }

  function flushOnLeave() {
    if (!state.ready) return;
    collectVisibleText();
    Object.values(state.saveTimers).forEach((timer) => clearTimeout(timer));
    state.saveTimers = {};
    Object.entries(state.pendingSaves).forEach(([date, text]) => {
      keepalivePut("/api/days", { date, text });
      delete state.pendingSaves[date];
    });
    if (state.pendingMeta) {
      state.pendingMeta = false;
      keepalivePut("/api/week/meta", {
        year: state.year,
        week: state.week,
        cumplimiento: els.cumplimiento.value,
        proyecciones: els.proyecciones.value,
        observaciones: els.observaciones.value,
        resumen: els.resumen.value,
      });
    }
    if (state.pendingSettings) {
      state.pendingSettings = false;
      keepalivePut("/api/settings", {
        nombre: els.nombre.value.trim(),
        cargo: els.cargo.value.trim(),
        unidad: els.unidad.value.trim(),
      });
    }
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
      resumen: els.resumen.value,
    };
  }

  function queuePreview() {
    state.previewQueued = true;
    refreshPreview().catch((err) => {
      if (err.name !== "AbortError") setPreviewStatus("Error al generar");
    });
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
    if (state.previewInFlight) return;

    while (state.previewQueued) {
      state.previewQueued = false;
      if (state.ready) await flushPendingSaves().catch(() => {});
      collectVisibleText();
      const fingerprint = previewFingerprint();
      if (fingerprint === state.previewFingerprint) continue;

      if (state.previewAbort) state.previewAbort.abort();
      state.previewAbort = new AbortController();
      state.previewInFlight = true;
      setPreviewStatus("Actualizando…");
      try {
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
      } finally {
        state.previewInFlight = false;
      }
    }
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
    const wanted = state.wantedDay;
    if (wanted && state.days.some((d) => d.date === wanted)) return wanted;
    const today = todayIso();
    if (state.days.some((d) => d.date === today)) return today;
    return state.days[0] ? state.days[0].date : null;
  }

  function syncUrl() {
    const q = new URLSearchParams();
    q.set("year", String(state.year));
    q.set("week", String(state.week));
    if (state.selectedDate) q.set("day", state.selectedDate);
    const next = `?${q.toString()}`;
    if (`${location.pathname}${location.search}` !== `${location.pathname}${next}`) {
      history.replaceState(null, "", next);
    }
  }

  function setMode(mode) {
    collectVisibleText();
    state.mode = mode;
    document.body.classList.toggle("mode-day", mode === "day");
    document.body.classList.toggle("mode-week", mode === "week");
    document.body.classList.toggle("mode-general", mode === "general");
    els.btnModeDay.classList.toggle("is-active", mode === "day");
    els.btnModeWeek.classList.toggle("is-active", mode === "week");
    els.btnModeGeneral.classList.toggle("is-active", mode === "general");
    els.btnModeDay.setAttribute("aria-pressed", String(mode === "day"));
    els.btnModeWeek.setAttribute("aria-pressed", String(mode === "week"));
    els.btnModeGeneral.setAttribute("aria-pressed", String(mode === "general"));
    if (mode === "week") renderWeekDays();
    else if (mode === "day") renderDayView();
    else updateGeneralChip();
  }

  function selectDay(date) {
    collectVisibleText();
    state.selectedDate = date;
    state.wantedDay = date;
    renderDayView();
    syncUrl();
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
        syncDayText(day.date, ta.value);
        queuePreview();
      });
      ta.addEventListener("change", () => {
        syncDayText(day.date, ta.value);
        queuePreview();
      });
      els.days.appendChild(wrap);
    });
    updateFilledChip();
  }

  function renderViews() {
    if (state.mode === "week") renderWeekDays();
    else if (state.mode === "day") renderDayView();
    else updateGeneralChip();
  }

  async function loadWeek(year, week) {
    const wasReady = state.ready;
    if (wasReady) await flushPendingSaves().catch(() => {});
    state.ready = false;
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
    els.cumplimiento.value = data.cumplimiento || "";
    els.proyecciones.value = data.proyecciones || "";
    els.observaciones.value = data.observaciones || "";
    els.resumen.value = data.resumen || "";
    state.selectedDate = pickDefaultDay();
    els.year.value = data.year;
    els.week.value = data.week;
    els.weekRange.textContent = `Semana ${data.week} · ${data.rangeLabel}`;
    renderViews();
    syncUrl();
    state.ready = true;
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
    state.wantedDay = null;
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
    syncDayText(day.date, text);
    queuePreview();
  });
  els.dayEditor.addEventListener("change", () => {
    const day = selectedDay();
    if (!day) return;
    syncDayText(day.date, els.dayEditor.value);
    queuePreview();
  });

  els.btnModeDay.addEventListener("click", () => setMode("day"));
  els.btnModeWeek.addEventListener("click", () => setMode("week"));
  els.btnModeGeneral.addEventListener("click", () => setMode("general"));

  $("btn-prev-week").addEventListener("click", () => shiftWeek(-1));
  $("btn-next-week").addEventListener("click", () => shiftWeek(1));
  els.year.addEventListener("change", () => {
    state.wantedDay = null;
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert);
  });
  els.week.addEventListener("change", () => {
    state.wantedDay = null;
    loadWeek(Number(els.year.value), Number(els.week.value)).catch(alert);
  });

  ["nombre", "cargo", "unidad"].forEach((id) => {
    $(id).addEventListener("input", () => {
      queueSettingsSave();
      queuePreview();
    });
    $(id).addEventListener("change", () => {
      queueSettingsSave();
      queuePreview();
    });
  });

  ["cumplimiento", "proyecciones", "observaciones", "resumen"].forEach((id) => {
    $(id).addEventListener("input", () => {
      if (id === "resumen") updateGeneralChip();
      queueWeekMetaSave();
      queuePreview();
    });
    $(id).addEventListener("change", () => {
      if (id === "resumen") updateGeneralChip();
      queueWeekMetaSave();
      queuePreview();
    });
  });

  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnLeave();
  });

  $("btn-clear-days").addEventListener("click", async () => {
    if (!confirm("¿Borrar las actividades de esta semana (días y resumen general)?")) return;
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
    els.resumen.value = "";
    renderViews();
    queuePreview();
  });

  $("btn-download").addEventListener("click", () => {
    downloadPdf().catch((e) => alert(e.message));
  });

  $("btn-export").addEventListener("click", () => {
    exportJson().catch((e) => alert(e.message));
  });

  $("btn-import").addEventListener("click", () => {
    $("import-file").click();
  });

  $("import-file").addEventListener("change", async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    try {
      await importJson(file);
    } catch (e) {
      alert(e.message);
    }
  });

  async function exportJson() {
    await flushPendingSaves();
    const res = await fetch("/api/export");
    if (!res.ok) throw new Error("No se pudo exportar");
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const filename = match
      ? decodeURIComponent(match[1].replace(/"/g, ""))
      : "bitacora.json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function importJson(file) {
    await flushPendingSaves();
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("El archivo no es un JSON válido");
    }
    const replace = confirm(
      "¿Reemplazar toda la bitácora con este archivo?\n\nAceptar = borrar lo actual e importar.\nCancelar = fusionar (actualizar solo los días del archivo)."
    );
    const res = await fetch(`/api/import?replace=${replace ? "1" : "0"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "No se pudo importar");
    }
    const result = await res.json();
    await loadWeek(Number(els.year.value), Number(els.week.value));
    alert(`Importados ${result.imported} día(s).`);
  }

  setMode("day");
  loadWeek(state.year, state.week).catch((e) => {
    els.weekRange.textContent = "Error cargando la semana";
    console.error(e);
  });
})();
