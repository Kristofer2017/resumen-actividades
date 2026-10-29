import { useEffect, useMemo, useRef, useState } from 'react'
import { useReport } from '../../context/reportContext.js'
import { useCommitSuggestions } from '../../hooks/useCommitSuggestions.js'
import Button from '../ui/Button.jsx'
import SuggestionDay from './SuggestionDay.jsx'

export default function SuggestionsDialog({ onClose }) {
  const { year, week, rangeLabel, days, meta, updateDayText, updateMeta } =
    useReport()
  const {
    data,
    loading,
    error,
    reload,
    aiLoading,
    aiError,
    generateWithAi,
  } = useCommitSuggestions({
    year,
    week,
    active: true,
  })

  const [items, setItems] = useState([])
  const [sourceData, setSourceData] = useState(null)
  const [target, setTarget] = useState('days')
  const [conflict, setConflict] = useState('append')
  const [copiedHash, setCopiedHash] = useState('')
  const [aiWarnings, setAiWarnings] = useState([])
  const closeRef = useRef(null)
  const copyTimer = useRef(null)

  if (data !== sourceData) {
    setSourceData(data)
    setItems(
      data
        ? data.days.flatMap((day) =>
            day.commits.map((commit) => ({
              ...commit,
              date: day.date,
              dayName: day.dayName,
              text: commit.suggestion,
              selected: true,
            })),
          )
        : [],
    )
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current)
    },
    [],
  )

  const allSelected = items.length > 0 && items.every((item) => item.selected)
  const selectedItems = useMemo(
    () => items.filter((item) => item.selected && item.text.trim()),
    [items],
  )
  const hasResumen = Boolean((meta.resumen || '').trim())
  const llmCount = items.filter((item) => item.source === 'llm').length
  const draftCount = items.length - llmCount
  const hasAi = llmCount > 0

  const toggleAll = () => {
    setItems((current) =>
      current.map((item) => ({ ...item, selected: !allSelected })),
    )
  }

  const toggleItem = (hash) => {
    setItems((current) =>
      current.map((item) =>
        item.hash === hash ? { ...item, selected: !item.selected } : item,
      ),
    )
  }

  const updateText = (hash, text) => {
    setItems((current) =>
      current.map((item) => (item.hash === hash ? { ...item, text } : item)),
    )
  }

  const copySuggestion = async (item) => {
    const text = item.text.trim()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopiedHash(item.hash)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedHash(''), 1600)
    } catch {
      window.alert('No se pudo copiar al portapapeles.')
    }
  }

  const generateAi = async () => {
    if (aiLoading || !data?.llm?.enabled || !data.days.length) return

    const edited = items.some(
      (item) => item.text.trim() !== (item.suggestion || '').trim(),
    )
    if (
      edited &&
      !window.confirm(
        'Se reemplazarán los textos que has editado con las sugerencias de la IA. ¿Continuar?',
      )
    ) {
      return
    }

    setAiWarnings([])
    const payload = await generateWithAi()
    if (!payload) return

    const byHash = new Map(
      payload.days
        .flatMap((day) => day.commits)
        .map((commit) => [commit.hash, commit]),
    )
    setItems((current) =>
      current.map((item) => {
        const aiCommit = byHash.get(item.hash)
        if (!aiCommit) return item
        return {
          ...item,
          text: aiCommit.suggestion,
          suggestion: aiCommit.suggestion,
          source: aiCommit.source,
          confidence: aiCommit.confidence,
        }
      }),
    )
    setAiWarnings(payload.warnings || [])
  }

  const apply = () => {
    if (!selectedItems.length) return

    if (target === 'summary') {
      const text = selectedItems.map((item) => item.text.trim()).join('\n\n')
      const current = (meta.resumen || '').trim()
      updateMeta(
        'resumen',
        conflict === 'replace'
          ? text
          : [current, text].filter(Boolean).join('\n\n'),
      )
    } else {
      const byDate = new Map()
      for (const item of selectedItems) {
        if (!byDate.has(item.date)) byDate.set(item.date, [])
        byDate.get(item.date).push(item.text.trim())
      }

      for (const [date, texts] of byDate) {
        const day = days.find((entry) => entry.date === date)
        const current = (day?.text || '').trim()
        updateDayText(
          date,
          conflict === 'replace'
            ? texts.join('\n')
            : [current, ...texts].filter(Boolean).join('\n'),
        )
      }
    }

    onClose()
  }

  let badgeClass = 'is-draft'
  let badgeText = 'Borrador automático'
  if (items.length && llmCount === items.length) {
    badgeClass = 'is-ai'
    badgeText = 'Redactado con IA'
  } else if (llmCount > 0) {
    badgeClass = 'is-mixed'
    badgeText = 'IA + borradores'
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="suggestion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestions-title"
      >
        <header className="suggestion-modal-head">
          <div>
            <h2 id="suggestions-title">Sugerencias de actividades</h2>
            <p className="suggestion-subtitle">
              Semana {week} · {data?.range?.label || rangeLabel}
              {data?.repo?.branch ? ` · rama ${data.repo.branch}` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="suggestion-modal-body">
          {loading ? (
            <div className="suggestion-loading" aria-live="polite">
              Buscando commits…
            </div>
          ) : null}

          {error ? (
            <div className="suggestion-error" role="alert">
              <p>{error}</p>
              <Button onClick={reload}>Reintentar</Button>
            </div>
          ) : null}

          {!loading && !error && data ? (
            <>
              <div className="suggestion-meta">
                <span
                  className={`suggestion-badge ${badgeClass}`}
                  title={
                    data.llm.model ? `Modelo: ${data.llm.model}` : undefined
                  }
                >
                  {badgeText}
                </span>
                <span title={data.author.email}>
                  Commits de {data.author.name}
                </span>
                <span>
                  {data.totalCommits} commits · {data.uniqueCommits} actividades
                </span>
              </div>

              {[...data.warnings, ...aiWarnings].map((warning, index) => (
                <p
                  className="suggestion-warning"
                  key={`${warning}-${index}`}
                >
                  {warning}
                </p>
              ))}

              <div className="suggestion-ai" aria-busy={aiLoading}>
                <div className="suggestion-ai-main">
                  <Button
                    className="suggest-ai"
                    onClick={generateAi}
                    disabled={
                      aiLoading ||
                      !data.llm.enabled ||
                      data.days.length === 0
                    }
                    title={
                      data.llm.model
                        ? `Modelo: ${data.llm.model}`
                        : undefined
                    }
                  >
                    {aiLoading
                      ? 'Redactando con IA…'
                      : hasAi
                        ? 'Regenerar con IA'
                        : 'Redactar con IA'}
                  </Button>
                  <span className="suggestion-ai-note">
                    {data.llm.enabled
                      ? 'La IA solo se ejecuta cuando pulsas este botón.'
                      : 'IA no configurada: configura HESET_LLM_API_KEY.'}
                  </span>
                </div>
              </div>

              {aiError ? (
                <p className="suggestion-warning">
                  No se pudo generar con IA: {aiError}
                </p>
              ) : null}

              <div className="suggestion-options">
                <div className="suggestion-option-group">
                  <span className="suggestion-option-label">Aplicar a</span>
                  <label>
                    <input
                      type="radio"
                      name="suggestions-target"
                      value="days"
                      checked={target === 'days'}
                      onChange={() => setTarget('days')}
                    />
                    Días (lun–vie)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="suggestions-target"
                      value="summary"
                      checked={target === 'summary'}
                      onChange={() => setTarget('summary')}
                    />
                    Resumen semanal
                  </label>
                </div>

                <div className="suggestion-option-group">
                  <span className="suggestion-option-label">
                    Si ya hay texto
                  </span>
                  <label>
                    <input
                      type="radio"
                      name="suggestions-conflict"
                      value="append"
                      checked={conflict === 'append'}
                      onChange={() => setConflict('append')}
                    />
                    Agregar al final
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="suggestions-conflict"
                      value="replace"
                      checked={conflict === 'replace'}
                      onChange={() => setConflict('replace')}
                    />
                    Reemplazar
                  </label>
                </div>
              </div>

              {target === 'days' && hasResumen ? (
                <p className="suggestion-warning">
                  Hay un resumen general; el PDF lo usa en lugar del desglose
                  por días.
                </p>
              ) : null}

              {data.days.length === 0 ? (
                <p className="suggestion-empty">
                  No hay commits tuyos en esta semana.
                </p>
              ) : (
                <>
                  <div className="suggestion-toolbar">
                    <label>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                      Seleccionar todo
                    </label>
                    <span>
                      {selectedItems.length} de {items.length} seleccionadas
                      {draftCount && llmCount
                        ? ` · ${draftCount} sin IA`
                        : ''}
                    </span>
                  </div>

                  {data.days.map((day) => (
                    <SuggestionDay
                      key={day.date}
                      day={day}
                      items={items.filter((item) => item.date === day.date)}
                      copiedHash={copiedHash}
                      onToggle={toggleItem}
                      onTextChange={updateText}
                      onCopy={copySuggestion}
                    />
                  ))}
                </>
              )}
            </>
          ) : null}
        </div>

        <footer className="suggestion-modal-foot">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={apply}
            disabled={
              loading || aiLoading || Boolean(error) || !selectedItems.length
            }
          >
            Aplicar{selectedItems.length ? ` (${selectedItems.length})` : ''}
          </Button>
        </footer>
      </section>
    </div>
  )
}
