import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPreview } from '../api/reportApi'

const PREVIEW_DELAY_MS = 300

/**
 * Genera la vista previa del PDF en segundo plano. Si llegan cambios mientras
 * hay una petición en curso, se encola una sola regeneración adicional.
 */
export function usePreview({ buildFingerprint, buildPayload, flushAll }) {
  const [blob, setBlob] = useState(null)
  const [status, setStatus] = useState('')

  const queued = useRef(false)
  const inFlight = useRef(false)
  const fingerprint = useRef('')
  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
      clearTimeout(timerRef.current)
    }
  }, [])

  const run = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true

    try {
      while (queued.current) {
        queued.current = false

        try {
          // El backend arma el PDF desde SQLite, por eso hay que guardar antes.
          await flushAll()
        } catch {
          // La vista previa se genera igual con lo último guardado.
        }

        const nextFingerprint = buildFingerprint()
        if (nextFingerprint === fingerprint.current) continue

        abortRef.current?.abort()
        abortRef.current = new AbortController()
        setStatus('Actualizando…')

        const nextBlob = await fetchPreview(
          buildPayload(),
          abortRef.current.signal,
        )
        if (!aliveRef.current) return

        setBlob(nextBlob)
        fingerprint.current = nextFingerprint
      }

      if (aliveRef.current) setStatus('')
    } catch (error) {
      if (error.name !== 'AbortError' && aliveRef.current) {
        setStatus('Error al generar')
        console.error(error)
      }
    } finally {
      inFlight.current = false
    }
  }, [buildFingerprint, buildPayload, flushAll])

  const schedule = useCallback(() => {
    queued.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      run()
    }, PREVIEW_DELAY_MS)
  }, [run])

  const invalidate = useCallback(() => {
    fingerprint.current = ''
  }, [])

  return { blob, status, schedule, invalidate }
}
