const JSON_HEADERS = { 'Content-Type': 'application/json' }

function ensureOk(response, message) {
  if (!response.ok) throw new Error(message)
  return response
}

function filenameFromDisposition(header, fallback) {
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header || '')
  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallback
}

export async function getDefaults() {
  const response = ensureOk(
    await fetch('/api/defaults'),
    'No se pudieron cargar los datos',
  )
  return response.json()
}

export async function getWeek(year, week) {
  const query = new URLSearchParams({ year: String(year), week: String(week) })
  const response = ensureOk(
    await fetch(`/api/week?${query}`),
    'No se pudo cargar la semana',
  )
  return response.json()
}

export async function fetchSuggestions(
  year,
  week,
  { ai = false, signal } = {},
) {
  const query = new URLSearchParams({ year: String(year), week: String(week) })
  if (ai) query.set('ai', '1')
  const response = await fetch(`/api/suggestions?${query}`, { signal })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(
      payload.error || 'No se pudieron obtener las sugerencias',
    )
  }
  return response.json()
}

export async function saveDay(date, text) {
  ensureOk(
    await fetch('/api/days', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ date, text }),
    }),
    'No se pudo guardar el día',
  )
}

export async function saveWeekMeta(payload) {
  ensureOk(
    await fetch('/api/week/meta', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
    'No se pudieron guardar las secciones de la semana',
  )
}

export async function saveSettings(payload) {
  ensureOk(
    await fetch('/api/settings', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
    'No se pudieron guardar nombre y cargo',
  )
}

export async function clearWeekDays(year, week) {
  ensureOk(
    await fetch('/api/week/clear-days', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ year, week }),
    }),
    'No se pudieron borrar los días',
  )
}

export async function fetchPreview(payload, signal) {
  const response = ensureOk(
    await fetch('/api/preview', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
      signal,
    }),
    'Error al generar el PDF',
  )
  return response.blob()
}

export async function fetchPdf(payload) {
  const response = ensureOk(
    await fetch('/api/pdf', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
    'Error al generar el PDF',
  )
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('Content-Disposition'),
      'informe-actividades.pdf',
    ),
  }
}

export async function fetchDocx(payload) {
  const response = ensureOk(
    await fetch('/api/docx', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
    'Error al generar el documento de Word',
  )
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('Content-Disposition'),
      'informe-actividades.docx',
    ),
  }
}

export async function fetchExport() {
  const response = ensureOk(await fetch('/api/export'), 'No se pudo exportar')
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('Content-Disposition'),
      'bitacora.json',
    ),
  }
}

export async function importData(data, replace) {
  const response = await fetch(`/api/import?replace=${replace ? '1' : '0'}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'No se pudo importar')
  }
  return response.json()
}

export function keepalivePut(url, body) {
  fetch(url, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}
