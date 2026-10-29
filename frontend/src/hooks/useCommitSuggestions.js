import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSuggestions } from '../api/reportApi'

export function useCommitSuggestions({ year, week, active }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const abortRef = useRef(null)
  const aiAbortRef = useRef(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (year == null || week == null) return

    abortRef.current?.abort()
    aiAbortRef.current?.abort()
    setAiLoading(false)
    setAiError('')

    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestRef.current

    setLoading(true)
    setError('')
    setData(null)

    try {
      const payload = await fetchSuggestions(year, week, {
        signal: controller.signal,
      })
      if (requestId === requestRef.current) setData(payload)
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && requestId === requestRef.current) {
        setError(loadError.message)
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [year, week])

  const generateWithAi = useCallback(async () => {
    if (year == null || week == null) return null

    aiAbortRef.current?.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller

    setAiLoading(true)
    setAiError('')

    try {
      return await fetchSuggestions(year, week, {
        ai: true,
        signal: controller.signal,
      })
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setAiError(loadError.message)
      return null
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null
        setAiLoading(false)
      }
    }
  }, [year, week])

  useEffect(() => {
    if (!active) return undefined
    const timer = window.setTimeout(load, 0)
    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
      aiAbortRef.current?.abort()
    }
  }, [active, load])

  return {
    data,
    loading,
    error,
    reload: load,
    aiLoading,
    aiError,
    generateWithAi,
  }
}
