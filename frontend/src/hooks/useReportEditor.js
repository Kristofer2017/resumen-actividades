import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearWeekDays,
  fetchDocx,
  fetchExport,
  fetchPdf,
  getDefaults,
  getWeek,
  importData,
} from '../api/reportApi'
import { isoWeek, pickDefaultDay } from '../utils/dates'
import { downloadBlob } from '../utils/download'
import { filledLabel, resumenLabel } from '../utils/labels'
import { usePreview } from './usePreview'
import { useSaveQueue } from './useSaveQueue'

const EMPTY_META = {
  cumplimiento: '',
  proyecciones: '',
  observaciones: '',
  resumen: '',
}

const EMPTY_PROFILE = { nombre: '', cargo: '', unidad: '' }

export function useReportEditor(initial) {
  const fallbackWeek = isoWeek()
  const [year, setYear] = useState(initial.year ?? fallbackWeek.year)
  const [week, setWeek] = useState(initial.week ?? fallbackWeek.week)
  const [rangeLabel, setRangeLabel] = useState('')
  const [days, setDays] = useState([])
  const [meta, setMeta] = useState(EMPTY_META)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [mode, setMode] = useState('day')
  const [selectedDate, setSelectedDate] = useState(initial.day ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const daysRef = useRef([])
  const metaRef = useRef(EMPTY_META)
  const profileRef = useRef(EMPTY_PROFILE)
  const yearRef = useRef(initial.year ?? fallbackWeek.year)
  const weekRef = useRef(initial.week ?? fallbackWeek.week)
  const wantedDayRef = useRef(initial.day ?? null)

  const getDays = useCallback(() => daysRef.current, [])
  const getMeta = useCallback(
    () => ({
      year: yearRef.current,
      week: weekRef.current,
      ...metaRef.current,
    }),
    [],
  )
  const getProfile = useCallback(() => ({ ...profileRef.current }), [])

  const notifyError = useCallback((saveError) => {
    if (saveError) window.alert(saveError.message)
  }, [])

  const saves = useSaveQueue({
    getDays,
    getMeta,
    getProfile,
    onError: notifyError,
  })

  const buildPayload = useCallback(
    () => ({
      nombre: profileRef.current.nombre.trim(),
      cargo: profileRef.current.cargo.trim(),
      unidad: profileRef.current.unidad.trim(),
      year: yearRef.current,
      week: weekRef.current,
      ...metaRef.current,
    }),
    [],
  )

  const buildFingerprint = useCallback(
    () =>
      JSON.stringify({
        ...buildPayload(),
        days: daysRef.current.reduce((acc, day) => {
          acc[day.date] = day.text
          return acc
        }, {}),
      }),
    [buildPayload],
  )

  const { flushAll, scheduleDay, scheduleMeta, scheduleProfile, cancelDaySaves } =
    saves

  const preview = usePreview({
    buildFingerprint,
    buildPayload,
    flushAll,
  })
  const schedulePreview = preview.schedule
  const invalidatePreview = preview.invalidate

  const applyWeekData = useCallback((data) => {
    daysRef.current = data.days
    setDays(data.days)

    const nextMeta = {
      cumplimiento: data.cumplimiento || '',
      proyecciones: data.proyecciones || '',
      observaciones: data.observaciones || '',
      resumen: data.resumen || '',
    }
    metaRef.current = nextMeta
    setMeta(nextMeta)

    yearRef.current = data.year
    weekRef.current = data.week
    setYear(data.year)
    setWeek(data.week)
    setRangeLabel(data.rangeLabel || '')

    const nextSelected = pickDefaultDay(data.days, wantedDayRef.current)
    setSelectedDate(nextSelected)
  }, [])

  const loadWeek = useCallback(
    async (nextYear, nextWeek) => {
      setLoading(true)
      setError('')

      try {
        await flushAll()
      } catch {
        // Si falla un guardado previo, igual intentamos cargar la semana.
      }

      try {
        const data = await getWeek(nextYear, nextWeek)
        applyWeekData(data)
        setLoading(false)
        invalidatePreview()
        schedulePreview()
      } catch (loadError) {
        setLoading(false)
        setError('Error cargando la semana')
        throw loadError
      }
    },
    [applyWeekData, flushAll, invalidatePreview, schedulePreview],
  )

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      let defaults = null
      try {
        defaults = await getDefaults()
      } catch {
        // El backend responde con defaults si no hay configuración guardada.
      }
      if (cancelled) return

      if (defaults) {
        const nextProfile = {
          nombre: defaults.nombre || '',
          cargo: defaults.cargo || '',
          unidad: defaults.unidad || '',
        }
        profileRef.current = nextProfile
        setProfile(nextProfile)
      }

      const current = isoWeek()
      const nextYear = initial.year ?? defaults?.year ?? current.year
      const nextWeek = initial.week ?? defaults?.week ?? current.week

      try {
        await loadWeek(nextYear, nextWeek)
      } catch {
        // El subtítulo ya muestra el error.
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
    // Solo se ejecuta al montar: los parámetros iniciales son inmutables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (year == null || week == null) return

    const params = new URLSearchParams()
    params.set('year', String(year))
    params.set('week', String(week))
    if (selectedDate) params.set('day', selectedDate)

    const next = `${window.location.pathname}?${params.toString()}`
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [year, week, selectedDate])

  const selectDay = useCallback((date) => {
    wantedDayRef.current = date
    setSelectedDate(date)
  }, [])

  const changeWeek = useCallback(
    (nextYear, nextWeek) => {
      wantedDayRef.current = null
      loadWeek(nextYear, nextWeek).catch((loadError) => {
        window.alert(loadError.message)
      })
    },
    [loadWeek],
  )

  const shiftWeek = useCallback(
    (delta) => {
      let nextYear = yearRef.current ?? isoWeek().year
      let nextWeek = (weekRef.current ?? isoWeek().week) + delta

      if (nextWeek < 1) {
        nextYear -= 1
        nextWeek = 52
      } else if (nextWeek > 53) {
        nextYear += 1
        nextWeek = 1
      }

      changeWeek(nextYear, nextWeek)
    },
    [changeWeek],
  )

  const updateDayText = useCallback(
    (date, text) => {
      const nextDays = daysRef.current.map((day) =>
        day.date === date ? { ...day, text } : day,
      )
      daysRef.current = nextDays
      setDays(nextDays)
      scheduleDay(date, text)
      schedulePreview()
    },
    [scheduleDay, schedulePreview],
  )

  const updateMeta = useCallback(
    (field, value) => {
      const nextMeta = { ...metaRef.current, [field]: value }
      metaRef.current = nextMeta
      setMeta(nextMeta)
      scheduleMeta()
      schedulePreview()
    },
    [scheduleMeta, schedulePreview],
  )

  const updateProfile = useCallback(
    (field, value) => {
      const nextProfile = { ...profileRef.current, [field]: value }
      profileRef.current = nextProfile
      setProfile(nextProfile)
      scheduleProfile()
      schedulePreview()
    },
    [scheduleProfile, schedulePreview],
  )

  const clearWeek = useCallback(async () => {
    const confirmed = window.confirm(
      '¿Borrar las actividades de esta semana (días y resumen general)?',
    )
    if (!confirmed) return

    cancelDaySaves()
    await flushAll()
    await clearWeekDays(yearRef.current, weekRef.current)

    const nextDays = daysRef.current.map((day) => ({ ...day, text: '' }))
    daysRef.current = nextDays
    setDays(nextDays)

    const nextMeta = { ...metaRef.current, resumen: '' }
    metaRef.current = nextMeta
    setMeta(nextMeta)

    schedulePreview()
  }, [cancelDaySaves, flushAll, schedulePreview])

  const downloadPdf = useCallback(async () => {
    await flushAll()
    const { blob, filename } = await fetchPdf(buildPayload())
    downloadBlob(blob, filename)
  }, [buildPayload, flushAll])

  const downloadDocx = useCallback(async () => {
    await flushAll()
    const { blob, filename } = await fetchDocx(buildPayload())
    downloadBlob(blob, filename)
  }, [buildPayload, flushAll])

  const exportJson = useCallback(async () => {
    await flushAll()
    const { blob, filename } = await fetchExport()
    downloadBlob(blob, filename)
  }, [flushAll])

  const importJson = useCallback(
    async (file) => {
      await flushAll()

      const raw = await file.text()
      let data
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error('El archivo no es un JSON válido')
      }

      const replace = window.confirm(
        '¿Reemplazar toda la bitácora con este archivo?\n\n' +
          'Aceptar = borrar lo actual e importar.\n' +
          'Cancelar = fusionar (actualizar solo los días del archivo).',
      )

      const result = await importData(data, replace)
      await loadWeek(yearRef.current, weekRef.current)
      window.alert(`Importados ${result.imported} día(s).`)
    },
    [flushAll, loadWeek],
  )

  const filledCount = days.filter((day) => (day.text || '').trim()).length
  const hasResumen = Boolean((meta.resumen || '').trim())

  return {
    year,
    week,
    rangeLabel,
    days,
    meta,
    profile,
    mode,
    selectedDate,
    loading,
    error,
    previewBlob: preview.blob,
    previewStatus: preview.status,
    filledCount,
    filledDaysLabel: filledLabel(filledCount),
    resumenChip: resumenLabel(hasResumen, filledCount),
    setMode,
    selectDay,
    changeWeek,
    shiftWeek,
    updateDayText,
    updateMeta,
    updateProfile,
    clearWeek,
    downloadPdf,
    downloadDocx,
    exportJson,
    importJson,
  }
}
