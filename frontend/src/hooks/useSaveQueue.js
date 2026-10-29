import { useCallback, useEffect, useRef } from 'react'
import {
  keepalivePut,
  saveDay,
  saveSettings,
  saveWeekMeta,
} from '../api/reportApi'

const SAVE_DELAY_MS = 250

/**
 * Cola de guardado con debounce. Mantiene el texto pendiente en refs para no
 * perder cambios al cambiar de semana o al cerrar la pestaña.
 */
export function useSaveQueue({ getDays, getMeta, getProfile, onError }) {
  const timers = useRef({})
  const pendingDays = useRef({})
  const inFlightDays = useRef({})
  const pendingMeta = useRef(false)
  const pendingProfile = useRef(false)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const reportError = useCallback((error) => {
    if (error) onErrorRef.current?.(error)
  }, [])

  const persistDay = useCallback((date) => {
    if (inFlightDays.current[date]) return inFlightDays.current[date]

    const task = Promise.resolve()
      .then(async () => {
        while (Object.hasOwn(pendingDays.current, date)) {
          const text = pendingDays.current[date]
          delete pendingDays.current[date]
          try {
            await saveDay(date, text)
          } catch (error) {
            if (!Object.hasOwn(pendingDays.current, date)) {
              pendingDays.current[date] = text
            }
            throw error
          }
        }
      })
      .finally(() => {
        delete inFlightDays.current[date]
      })

    inFlightDays.current[date] = task
    return task
  }, [])

  const persistMeta = useCallback(async () => {
    if (!pendingMeta.current) return
    pendingMeta.current = false
    try {
      await saveWeekMeta(getMeta())
    } catch (error) {
      pendingMeta.current = true
      throw error
    }
  }, [getMeta])

  const persistProfile = useCallback(async () => {
    if (!pendingProfile.current) return
    pendingProfile.current = false
    try {
      await saveSettings(getProfile())
    } catch (error) {
      pendingProfile.current = true
      throw error
    }
  }, [getProfile])

  const scheduleDay = useCallback(
    (date, text) => {
      pendingDays.current[date] = text
      clearTimeout(timers.current[date])
      timers.current[date] = setTimeout(() => {
        delete timers.current[date]
        persistDay(date).catch(reportError)
      }, SAVE_DELAY_MS)
    },
    [persistDay, reportError],
  )

  const scheduleMeta = useCallback(() => {
    pendingMeta.current = true
    clearTimeout(timers.current.meta)
    timers.current.meta = setTimeout(() => {
      delete timers.current.meta
      persistMeta().catch(reportError)
    }, SAVE_DELAY_MS)
  }, [persistMeta, reportError])

  const scheduleProfile = useCallback(() => {
    pendingProfile.current = true
    clearTimeout(timers.current.profile)
    timers.current.profile = setTimeout(() => {
      delete timers.current.profile
      persistProfile().catch(reportError)
    }, SAVE_DELAY_MS)
  }, [persistProfile, reportError])

  const flushAll = useCallback(async () => {
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}

    const dates = new Set(getDays().map((day) => day.date))
    Object.keys(pendingDays.current).forEach((date) => dates.add(date))
    await Promise.all([...dates].map((date) => persistDay(date)))
    await persistMeta()
    await persistProfile()
  }, [getDays, persistDay, persistMeta, persistProfile])

  const cancelDaySaves = useCallback(() => {
    Object.keys(timers.current).forEach((key) => {
      if (key === 'meta' || key === 'profile') return
      clearTimeout(timers.current[key])
      delete timers.current[key]
    })
    pendingDays.current = {}
  }, [])

  useEffect(() => {
    const flushOnLeave = () => {
      Object.values(timers.current).forEach(clearTimeout)
      timers.current = {}

      Object.entries(pendingDays.current).forEach(([date, text]) => {
        keepalivePut('/api/days', { date, text })
        delete pendingDays.current[date]
      })

      if (pendingMeta.current) {
        pendingMeta.current = false
        keepalivePut('/api/week/meta', getMeta())
      }

      if (pendingProfile.current) {
        pendingProfile.current = false
        keepalivePut('/api/settings', getProfile())
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnLeave()
    }

    window.addEventListener('pagehide', flushOnLeave)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushOnLeave)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [getMeta, getProfile])

  return { scheduleDay, scheduleMeta, scheduleProfile, flushAll, cancelDaySaves }
}
